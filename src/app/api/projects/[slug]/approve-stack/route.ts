import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, writeArtifact } from '@/app/api/lib/project-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { stack_choice, reasoning } = body;

    if (!stack_choice) {
      return NextResponse.json(
        { success: false, error: 'Stack choice is required' },
        { status: 400 }
      );
    }

    const metadata = getProjectMetadata(slug);

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const updated = {
      ...metadata,
      stack_choice,
      stack_approved: true,
      stack_approval_date: new Date().toISOString(),
      stack_reasoning: reasoning,
      updated_at: new Date().toISOString()
    };

    saveProjectMetadata(slug, updated);

    const stackContent = `---
title: "Technology Stack Selection"
owner: "architect"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "approved"
---

# Technology Stack Selection

## Selected Stack
**${stack_choice}**

## Rationale
${reasoning || 'Stack selection approved.'}

## Date Approved
${new Date().toISOString()}
`;

    writeArtifact(slug, 'STACK_SELECTION', 'plan.md', stackContent);

    const readmeContent = `# Stack Selection Documentation

This folder contains documentation about the approved technology stack for this project.

## Approved Stack
**${stack_choice}**

## Selection Details
See plan.md for the full rationale and decision documentation.
`;

    writeArtifact(slug, 'STACK_SELECTION', 'README.md', readmeContent);

    return NextResponse.json({
      success: true,
      data: {
        slug,
        stack_choice,
        stack_approved: true,
        message: 'Stack selection approved successfully'
      }
    });
  } catch (error) {
    console.error('Error approving stack:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve stack' },
      { status: 500 }
    );
  }
}
