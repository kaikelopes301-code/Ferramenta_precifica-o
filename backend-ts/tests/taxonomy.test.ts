import { describe, it, expect } from 'vitest'
import { detectCategory } from '../src/search/semantic/taxonomy.js'

describe('taxonomy.detectCategory', () => {
  it('mop -> MOP', () => {
    expect(detectCategory('mop')).toBe('MOP')
  })

  it('esfregão -> MOP (strong)', () => {
    expect(detectCategory('esfregão')).toBe('MOP')
  })

  it('vassoura -> VASSOURA', () => {
    expect(detectCategory('vassoura')).toBe('VASSOURA')
  })
})
