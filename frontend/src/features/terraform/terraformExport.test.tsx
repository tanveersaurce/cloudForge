import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TerraformExportPage } from './TerraformExportPage';
import * as terraformService from './terraformService';
import { createZipArchive } from './zipUtility';

vi.mock('./terraformService', () => ({
  generateTerraformApi: vi.fn(),
}));

describe('TerraformExportPage & Modular Export', () => {
  const mockModularResponse: terraformService.TerraformGenerateResponse = {
    mode: 'modular',
    totalFiles: 8,
    hcl: '// === main.tf ===\nmodule "networking" {\n  source = "./modules/networking"\n}',
    issues: [
      {
        nodeId: 'node-ec2-1',
        resourceType: 'aws_instance',
        missing: 'AMI ID not configured — using var.ec2_ami placeholder',
        severity: 'warning',
      },
    ],
    files: [
      {
        filename: 'main.tf',
        content: 'module "networking" {\n  source = "./modules/networking"\n}',
      },
      {
        filename: 'versions.tf',
        content: 'terraform {\n  required_version = ">= 1.5"\n}',
      },
      {
        filename: 'variables.tf',
        content: 'variable "aws_region" {\n  type = string\n}',
      },
      {
        filename: 'outputs.tf',
        content: 'output "vpc_id" {\n  value = module.networking.vpc_id\n}',
      },
      {
        filename: 'modules/networking/main.tf',
        content: 'resource "aws_vpc" "main" {\n  cidr_block = var.vpc_cidr\n}',
      },
      {
        filename: 'modules/networking/variables.tf',
        content: 'variable "vpc_cidr" {\n  type = string\n}',
      },
      {
        filename: 'modules/networking/outputs.tf',
        content: 'output "vpc_id" {\n  value = aws_vpc.main.id\n}',
      },
      {
        filename: 'environments/dev/terraform.tfvars.example',
        content: 'aws_region = "us-east-1"\nenvironment = "dev"',
      },
    ],
  };

  const mockStandardResponse: terraformService.TerraformGenerateResponse = {
    mode: 'standard',
    totalFiles: 4,
    hcl: '// === versions.tf ===\nterraform {}',
    issues: [],
    files: [
      { filename: 'versions.tf', content: 'terraform {}' },
      { filename: 'provider.tf', content: 'provider "aws" {}' },
      { filename: 'variables.tf', content: 'variable "aws_region" {}' },
      { filename: 'vpc/main_vpc.tf', content: 'resource "aws_vpc" "main" {}' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modular export mode by default with directory tree and root orchestration', async () => {
    vi.mocked(terraformService.generateTerraformApi).mockResolvedValueOnce(mockModularResponse);

    render(
      <MemoryRouter initialEntries={['/terraform/arch-123']}>
        <Routes>
          <Route path="/terraform/:architectureId" element={<TerraformExportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Initial loading indicator
    expect(screen.getByText(/Generating Modular Terraform Project/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Modular Terraform')).toBeInTheDocument();
    });

    // Verify mode button is active
    expect(screen.getByText('Standard')).toBeInTheDocument();

    // Verify Project Explorer tree items
    expect(screen.getAllByText('main.tf').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('versions.tf')).toBeInTheDocument();
    expect(screen.getByText('modules')).toBeInTheDocument();
    expect(screen.getByText('networking')).toBeInTheDocument();

    // Preview shows root main.tf content by default
    expect(screen.getByText(/module "networking"/i)).toBeInTheDocument();

    // Diagnostics warning badge is displayed
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Review Diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText(/AMI ID not configured/i)).toBeInTheDocument();
  });

  it('allows switching between Modular and Standard export modes', async () => {
    vi.mocked(terraformService.generateTerraformApi)
      .mockResolvedValueOnce(mockModularResponse)
      .mockResolvedValueOnce(mockStandardResponse);

    render(
      <MemoryRouter initialEntries={['/terraform/arch-123']}>
        <Routes>
          <Route path="/terraform/:architectureId" element={<TerraformExportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Modular Terraform')).toBeInTheDocument();
    });

    // Click "Standard" mode button
    const standardBtn = screen.getByRole('button', { name: /Standard/i });
    fireEvent.click(standardBtn);

    await waitFor(() => {
      expect(terraformService.generateTerraformApi).toHaveBeenCalledWith('arch-123', 'standard');
    });

    await waitFor(() => {
      expect(screen.getByText('vpc')).toBeInTheDocument();
      expect(screen.getByText('main_vpc.tf')).toBeInTheDocument();
    });
  });

  it('allows clicking files in directory tree to preview their code', async () => {
    vi.mocked(terraformService.generateTerraformApi).mockResolvedValueOnce(mockModularResponse);

    render(
      <MemoryRouter initialEntries={['/terraform/arch-123']}>
        <Routes>
          <Route path="/terraform/:architectureId" element={<TerraformExportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('versions.tf')).toBeInTheDocument();
    });

    // Click on versions.tf
    fireEvent.click(screen.getByText('versions.tf'));

    // Preview changes to versions.tf
    await waitFor(() => {
      expect(screen.getByText(/required_version = ">= 1.5"/i)).toBeInTheDocument();
    });
  });

  it('creates valid ZIP archives containing directory structure with PKZip header', async () => {
    const files = [
      { filename: 'main.tf', content: 'terraform {}' },
      { filename: 'modules/networking/main.tf', content: 'resource "aws_vpc" "main" {}' },
    ];

    const blob = createZipArchive(files);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(100);

    // Read bytes using FileReader (compatible with jsdom and browsers)
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });

    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });
});
