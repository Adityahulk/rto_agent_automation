import type { ReactNode } from 'react'
import { Component } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Page render error', error)
  }

  retry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto mt-12 max-w-xl rounded-lg border border-border-card bg-bg-card p-6 text-center">
          <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
          <p className="mt-2 text-sm text-text-secondary">
            We could not render this page. Please retry.
          </p>
          <Button className="mt-4" onClick={this.retry}>
            Retry
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
