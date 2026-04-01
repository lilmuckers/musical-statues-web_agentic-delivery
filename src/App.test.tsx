import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

describe('App shell baseline', () => {
  it('renders the placeholder host shell and allows phase progression', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Host control baseline' })).toBeInTheDocument()
    expect(screen.getByText('Current phase: Setup')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Prepare host session' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mark setup complete' }))

    expect(screen.getByText('Current phase: Ready')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ready for the first round' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start round' }))

    expect(screen.getByText('Current phase: Playing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trigger freeze' })).toBeInTheDocument()
  })

  it('shows the freeze and session-end placeholder states', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Freeze Freeze moment' }))
    expect(screen.getByText('Current phase: Freeze')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Freeze moment' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'End session' }))
    expect(screen.getByText('Current phase: Session end')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Session complete' })).toBeDisabled()
  })
})
