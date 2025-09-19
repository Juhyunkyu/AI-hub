/**
 * Zod Validation Demo Component
 *
 * Demonstrates the complete Supazod-based validation system:
 * - Client-side validation with useValidation hook
 * - Server-side API integration
 * - Enhanced schemas with custom validation rules
 * - Error handling and user feedback
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useFormValidation } from '@/lib/hooks/useValidation';
import {
  EnhancedPostSchema,
  EnhancedProfileSchema,
  PostQuerySchema,
  publicPostsInsertSchema,
} from '@/lib/schemas/supabase-generated';

export default function ZodValidationDemo() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Supazod Validation System Demo</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Complete demonstration of type-safe validation with Zod schemas
          generated from Supabase types, enhanced with custom validation rules.
        </p>
      </div>

      <Tabs defaultValue="post" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="post">Post Creation</TabsTrigger>
          <TabsTrigger value="profile">Profile Update</TabsTrigger>
          <TabsTrigger value="query">Query Validation</TabsTrigger>
          <TabsTrigger value="api">API Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="post">
          <PostValidationDemo />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileValidationDemo />
        </TabsContent>

        <TabsContent value="query">
          <QueryValidationDemo />
        </TabsContent>

        <TabsContent value="api">
          <APIValidationDemo />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Post Validation Demo
// ============================================================================

function PostValidationDemo() {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    url: '',
    post_type: 'general' as const,
    status: 'draft' as const,
  });

  const validation = useFormValidation(
    publicPostsInsertSchema.omit({
      id: true,
      created_at: true,
      updated_at: true,
      author_id: true,
    }),
    {
      validateOnChange: true,
      customMessages: {
        title: 'Please provide a meaningful title',
        content: 'Content should be descriptive and helpful',
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await validation.validate(formData);
    console.log('Validation result:', result);
  };

  const handleFieldChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    validation.validateField(field, value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post Creation with Enhanced Validation</CardTitle>
        <CardDescription>
          Uses publicPostsInsertSchema with real-time field validation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Enter post title..."
              className={validation.getFieldError('title') ? 'border-red-500' : ''}
            />
            {validation.getFieldError('title') && (
              <p className="text-sm text-red-500">{validation.getFieldError('title')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleFieldChange('content', e.target.value)}
              placeholder="Write your post content..."
              rows={4}
              className={validation.getFieldError('content') ? 'border-red-500' : ''}
            />
            {validation.getFieldError('content') && (
              <p className="text-sm text-red-500">{validation.getFieldError('content')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL (Optional)</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => handleFieldChange('url', e.target.value)}
              placeholder="https://example.com"
              className={validation.getFieldError('url') ? 'border-red-500' : ''}
            />
            {validation.getFieldError('url') && (
              <p className="text-sm text-red-500">{validation.getFieldError('url')}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button type="submit" disabled={!validation.isValid || validation.isValidating}>
              {validation.isValidating ? 'Validating...' : 'Create Post'}
            </Button>
            <Badge variant={validation.isValid ? 'default' : 'destructive'}>
              {validation.isValid ? 'Valid' : 'Invalid'}
            </Badge>
          </div>
        </form>

        {validation.data && (
          <Alert>
            <AlertDescription>
              <strong>Validated Data:</strong>
              <pre className="mt-2 text-xs overflow-auto">
                {JSON.stringify(validation.data, null, 2)}
              </pre>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Profile Validation Demo
// ============================================================================

function ProfileValidationDemo() {
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    avatar_url: '',
  });

  const validation = useFormValidation(EnhancedProfileSchema.partial(), {
    validateOnChange: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await validation.validate(formData);
    console.log('Profile validation result:', result);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Update with Enhanced Validation</CardTitle>
        <CardDescription>
          Uses EnhancedProfileSchema with custom username and bio validation rules
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => {
                setFormData({ ...formData, username: e.target.value });
                validation.validate({ ...formData, username: e.target.value });
              }}
              placeholder="Enter username (3-50 chars, alphanumeric)"
              className={validation.getFieldError('username') ? 'border-red-500' : ''}
            />
            {validation.getFieldError('username') && (
              <p className="text-sm text-red-500">{validation.getFieldError('username')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => {
                setFormData({ ...formData, bio: e.target.value });
                validation.validate({ ...formData, bio: e.target.value });
              }}
              placeholder="Tell us about yourself (max 500 chars)"
              rows={3}
              className={validation.getFieldError('bio') ? 'border-red-500' : ''}
            />
            {validation.getFieldError('bio') && (
              <p className="text-sm text-red-500">{validation.getFieldError('bio')}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.bio.length}/500 characters
            </p>
          </div>

          <Button type="submit" disabled={!validation.isValid}>
            Update Profile
          </Button>
        </form>

        {Object.keys(validation.fieldErrors).length > 0 && (
          <Alert>
            <AlertDescription>
              <strong>Validation Errors:</strong>
              <ul className="mt-2 space-y-1">
                {Object.entries(validation.fieldErrors).map(([field, error]) => (
                  <li key={field} className="text-sm">
                    <strong>{field}:</strong> {error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Query Validation Demo
// ============================================================================

function QueryValidationDemo() {
  const [queryData, setQueryData] = useState({
    page: '1',
    limit: '10',
    search: '',
    orderBy: 'created_at',
    order: 'desc' as const,
  });

  const validation = useFormValidation(PostQuerySchema, {
    validateOnChange: true,
  });

  React.useEffect(() => {
    validation.validate(queryData);
  }, [queryData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query Parameter Validation</CardTitle>
        <CardDescription>
          Uses PostQuerySchema with automatic type coercion and defaults
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="page">Page</Label>
            <Input
              id="page"
              type="number"
              value={queryData.page}
              onChange={(e) => setQueryData({ ...queryData, page: e.target.value })}
              min="1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="limit">Limit</Label>
            <Input
              id="limit"
              type="number"
              value={queryData.limit}
              onChange={(e) => setQueryData({ ...queryData, limit: e.target.value })}
              min="1"
              max="100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              value={queryData.search}
              onChange={(e) => setQueryData({ ...queryData, search: e.target.value })}
              placeholder="Search posts..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="orderBy">Order By</Label>
            <select
              id="orderBy"
              value={queryData.orderBy}
              onChange={(e) => setQueryData({ ...queryData, orderBy: e.target.value })}
              className="w-full p-2 border rounded"
            >
              <option value="created_at">Created At</option>
              <option value="updated_at">Updated At</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>

        {validation.data && (
          <Alert>
            <AlertDescription>
              <strong>Validated Query:</strong>
              <pre className="mt-2 text-xs overflow-auto">
                {JSON.stringify(validation.data, null, 2)}
              </pre>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// API Validation Demo
// ============================================================================

function APIValidationDemo() {
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async (testType: string, testData: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/validation-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_type: testType,
          data: testData,
        }),
      });

      const result = await response.json();
      setApiResponse(result);
    } catch (error) {
      setApiResponse({ error: 'API request failed' });
    } finally {
      setLoading(false);
    }
  };

  const testCases = [
    {
      name: 'Valid Post Data',
      type: 'post',
      data: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Valid Post Title',
        content: 'This is valid content for the post.',
        author_id: '123e4567-e89b-12d3-a456-426614174001',
        post_type: 'general',
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    {
      name: 'Invalid Post Data',
      type: 'post',
      data: {
        title: '', // Invalid: empty title
        content: 'Short', // Invalid: too short
        author_id: 'invalid-uuid', // Invalid: not a UUID
      },
    },
    {
      name: 'Valid Query Data',
      type: 'query',
      data: {
        page: '2',
        limit: '20',
        search: 'test search',
        orderBy: 'title',
        order: 'asc',
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Validation Testing</CardTitle>
        <CardDescription>
          Test the complete validation system including server-side API routes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          {testCases.map((testCase, index) => (
            <Button
              key={index}
              variant="outline"
              onClick={() => testAPI(testCase.type, testCase.data)}
              disabled={loading}
            >
              Test: {testCase.name}
            </Button>
          ))}
        </div>

        {loading && <p>Testing API validation...</p>}

        {apiResponse && (
          <Alert>
            <AlertDescription>
              <strong>API Response:</strong>
              <pre className="mt-2 text-xs overflow-auto max-h-96">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}