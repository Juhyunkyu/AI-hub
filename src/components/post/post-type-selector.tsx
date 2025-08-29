'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PostType, POST_TYPE_LABELS } from '@/types/post'
import { getAvailablePostTypes } from '@/lib/utils/post-utils'

interface PostTypeSelectorProps {
  value: PostType
  onChange: (value: PostType) => void
  isAdmin?: boolean
  disabled?: boolean
}

export function PostTypeSelector({ 
  value, 
  onChange, 
  isAdmin = false, 
  disabled = false 
}: PostTypeSelectorProps) {
  const availableTypes: PostType[] = isAdmin 
    ? ['general', 'notice', 'anonymous']
    : ['general', 'anonymous']

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">게시글 타입</label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="게시글 타입을 선택하세요" />
        </SelectTrigger>
        <SelectContent>
          {availableTypes.map(type => (
            <SelectItem key={type} value={type}>
              <div className="flex items-center gap-2">
                <span>{POST_TYPE_LABELS[type]}</span>
                {type === 'notice' && (
                  <Badge variant="secondary" className="text-xs">
                    관리자 전용
                  </Badge>
                )}
                {type === 'anonymous' && (
                  <Badge variant="outline" className="text-xs">
                    익명
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {value === 'notice' && (
        <p className="text-xs text-muted-foreground">
          공지사항은 모든 사용자에게 표시되며, 작성자가 관리자로 표시됩니다.
        </p>
      )}
      
      {value === 'anonymous' && (
        <p className="text-xs text-muted-foreground">
          익명 게시글은 본인의 프로필에서만 확인할 수 있습니다.
        </p>
      )}
    </div>
  )
}