import { render, screen } from '@testing-library/react'
import { ImagesApp } from './ImagesApp'

describe('ImagesApp', () => {
  it('renders the section title', () => {
    render(<ImagesApp />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Optimizador de imágenes' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Imágenes')).toBeInTheDocument()
  })

  it('starts with the drop zone', () => {
    render(<ImagesApp />)
    expect(screen.getByRole('button', { name: /elegir imágenes/i })).toBeInTheDocument()
  })
})
