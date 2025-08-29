'use client'

import { Button } from '@/components/ui/button'
import { PostType, POST_TYPE_LABELS } from '@/types/post'

interface PostTypeFilterProps {
  selectedTypes: PostType[]
  availableTypes: PostType[]
  onTypeChange: (type: PostType) => void
  className?: string
}

export function PostTypeFilter({ 
  selectedTypes, 
  availableTypes,
  onTypeChange,
  className 
}: PostTypeFilterProps) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {availableTypes.map(type => (
        <Button
          key={type}
          variant={selectedTypes.includes(type) ? "default" : "outline"}
          size="sm"
          onClick={() => onTypeChange(type)}
          className="h-8"
        >
          {POST_TYPE_LABELS[type]}
        </Button>
      ))}
    </div>
  )
}