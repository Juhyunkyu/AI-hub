'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { UserAvatar } from '@/components/user-avatar'
import { PostWithAuthor, POST_TYPE_LABELS, USER_ROLE_LABELS } from '@/types/post'
import { formatDate } from '@/lib/utils/date-format'

interface PostCardProps {
  post: PostWithAuthor
  showAuthorRole?: boolean
  className?: string
}

export function PostCard({ post, showAuthorRole = false, className }: PostCardProps) {
  const isNotice = post.post_type === 'notice'
  const isAnonymous = post.post_type === 'anonymous'
  const isAdmin = post.author.role === 'admin'

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserAvatar
              userId={post.author.id}
              username={post.author.username}
              avatarUrl={post.author.avatar_url}
              size="sm"
              showName={true}
              showActions={true}
              secondaryText={formatDate(post.created_at)}
            />
            
            {/* 게시글 타입 배지 */}
            {post.post_type !== 'general' && (
              <Badge 
                variant={isNotice ? 'default' : 'outline'}
                className={isNotice ? 'bg-blue-500 hover:bg-blue-600' : ''}
              >
                {POST_TYPE_LABELS[post.post_type]}
              </Badge>
            )}
            
            {/* 관리자 배지 (공지사항에서만 표시) */}
            {showAuthorRole && isNotice && isAdmin && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                {USER_ROLE_LABELS.admin}
              </Badge>
            )}
            
            {/* 익명 배지 */}
            {isAnonymous && (
              <Badge variant="outline" className="border-gray-300 text-gray-600">
                익명
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <Link href={`/posts/${post.id}`} className="block group">
          <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h3>
          
          {post.content && (
            <p className="text-muted-foreground text-sm line-clamp-3 mb-3">
              {post.content}
            </p>
          )}
          
          {post.thumbnail && (
            <div className="aspect-video relative overflow-hidden rounded-md mb-3">
              <img
                src={post.thumbnail}
                alt={post.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
              />
            </div>
          )}
        </Link>
      </CardContent>
    </Card>
  )
}