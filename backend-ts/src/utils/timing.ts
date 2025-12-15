/**
 * Timing Utility
 *
 * Provides utilities for collecting and reporting timing information
 * for performance monitoring and observability.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Single timing entry representing a measured operation
 */
export interface TimingEntry {
  /** Label describing the operation */
  label: string
  /** Duration in milliseconds */
  ms: number
}

/**
 * Timing collector interface for instrumenting code
 */
export interface TimingCollector {
  /**
   * Start timing an operation
   */
  start(label: string): void

  /**
   * End timing an operation
   */
  end(label: string): void

  /**
   * Get all collected timings
   */
  getTimings(): TimingEntry[]

  /**
   * Reset all timings
   */
  reset(): void
}

// =============================================================================
// Implementation
// =============================================================================

interface TimingState {
  startTime: number
  endTime?: number
}

/**
 * Simple timing collector implementation
 *
 * Tracks start/end times for labeled operations and computes durations.
 */
export class SimpleTimingCollector implements TimingCollector {
  private timings: Map<string, TimingState> = new Map()
  private completedTimings: TimingEntry[] = []

  start(label: string): void {
    this.timings.set(label, {
      startTime: performance.now(),
    })
  }

  end(label: string): void {
    const state = this.timings.get(label)
    if (!state) {
      // Label not started, ignore
      return
    }

    state.endTime = performance.now()
    const ms = state.endTime - state.startTime

    this.completedTimings.push({
      label,
      ms: Math.round(ms * 100) / 100, // Round to 2 decimals
    })
  }

  getTimings(): TimingEntry[] {
    return [...this.completedTimings]
  }

  reset(): void {
    this.timings.clear()
    this.completedTimings = []
  }
}

/**
 * Factory function to create a timing collector
 */
export function createTimingCollector(): TimingCollector {
  return new SimpleTimingCollector()
}

/**
 * No-op timing collector for when timing is disabled
 */
export class NoOpTimingCollector implements TimingCollector {
  start(_label: string): void {
    // No-op
  }

  end(_label: string): void {
    // No-op
  }

  getTimings(): TimingEntry[] {
    return []
  }

  reset(): void {
    // No-op
  }
}

/**
 * Create a no-op timing collector
 */
export function createNoOpTimingCollector(): TimingCollector {
  return new NoOpTimingCollector()
}
