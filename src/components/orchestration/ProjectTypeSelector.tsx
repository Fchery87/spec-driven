"use client"

import * as React from 'react'
import { ProjectType, PROJECT_TYPE_CONFIG } from '@/types/composition'
import { cn } from '@/lib/utils'
import { Monitor, Smartphone, Globe, Plug } from 'lucide-react'

const icons = {
  [ProjectType.WEB_APP]: Monitor,
  [ProjectType.MOBILE_APP]: Smartphone,
  [ProjectType.BOTH]: Globe,
  [ProjectType.API_ONLY]: Plug
}

interface ProjectTypeSelectorProps {
  selected: ProjectType
  onSelect: (type: ProjectType) => void
}

export function ProjectTypeSelector({ selected, onSelect }: ProjectTypeSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium mb-3">
        What type of project are you building?
      </label>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(PROJECT_TYPE_CONFIG).map(([type, config]) => {
          const projectType = type as ProjectType
          const Icon = icons[projectType]
          const isSelected = selected === projectType
          
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-state={isSelected ? 'checked' : 'unchecked'}
              onClick={() => onSelect(projectType)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                'hover:border-primary/50 hover:bg-muted/50',
                isSelected 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border bg-card'
              )}
            >
              <Icon className={cn(
                'w-6 h-6',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-sm font-medium',
                isSelected ? 'text-primary' : 'text-foreground'
              )}>
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground text-center">
                {config.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
