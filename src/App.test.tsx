import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the Woodland Hills Energy heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /woodland hills energy/i }),
    ).toBeInTheDocument()
  })
})
