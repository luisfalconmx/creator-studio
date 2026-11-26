import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

// The Videos home renders a WebGL (three.js) scene that jsdom can't run: the shell
// test only needs a placeholder for that section.
vi.mock('@creator-studio/videos', () => ({
  VideosApp: () => <h1>Videos</h1>,
}))

beforeEach(() => localStorage.clear())

describe('App shell', () => {
  it('shows the three sections in the rail', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    for (const label of ['Videos', 'Imágenes', 'Descargas']) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('opens Videos by default and switches sections', async () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(nav).getByRole('button', { name: 'Videos' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await userEvent.click(within(nav).getByRole('button', { name: 'Imágenes' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Optimizador de imágenes' })).toBeVisible()
    expect(localStorage.getItem('creator-studio.section')).toBe('images')
  })

  it('remembers the last section', () => {
    localStorage.setItem('creator-studio.section', 'downloads')
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(nav).getByRole('button', { name: 'Descargas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
