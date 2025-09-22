import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'

// Test용 QueryClient 설정
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity
      },
      mutations: {
        retry: false
      }
    }
  })

// Provider 래퍼 컴포넌트
interface AllTheProvidersProps {
  children: ReactNode
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  const queryClient = createTestQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

// 커스텀 render 함수
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// React Testing Library export 재정의
export * from '@testing-library/react'
export { customRender as render }

// 유용한 테스트 헬퍼들
export const waitForLoadingToFinish = () =>
  new Promise(resolve => setTimeout(resolve, 0))

export const createMockIntersectionObserver = () => {
  const { vi } = await import('vitest')
  const mockIntersectionObserver = vi.fn()
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null
  })
  window.IntersectionObserver = mockIntersectionObserver
  window.IntersectionObserverEntry = vi.fn()
}

export const createMockResizeObserver = () => {
  const { vi } = await import('vitest')
  const mockResizeObserver = vi.fn()
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null
  })
  window.ResizeObserver = mockResizeObserver
}

// 폼 테스트를 위한 헬퍼
export const fillForm = async (
  getByLabelText: any,
  formData: Record<string, string>
) => {
  const { userEvent } = await import('@testing-library/user-event')
  const user = userEvent.setup()

  for (const [label, value] of Object.entries(formData)) {
    const field = getByLabelText(new RegExp(label, 'i'))
    await user.clear(field)
    await user.type(field, value)
  }
}

// 모달 테스트를 위한 헬퍼
export const waitForModal = async (getByRole: any) => {
  const { waitFor } = await import('@testing-library/react')
  return waitFor(() => getByRole('dialog'))
}

// 로딩 상태 테스트를 위한 헬퍼
export const waitForLoadingState = async (queryByTestId: any, testId: string) => {
  const { waitFor } = await import('@testing-library/react')
  return waitFor(() => expect(queryByTestId(testId)).not.toBeInTheDocument())
}