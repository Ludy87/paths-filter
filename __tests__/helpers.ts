import { Filter, FilterConfig, PredicateQuantifier } from '../src/filter'

export const defaultFilterConfig: FilterConfig = {
  predicateQuantifier: PredicateQuantifier.SOME,
}

export function createFilter(yaml: string, overrides: Partial<FilterConfig> = {}): Filter {
  return new Filter(yaml, { ...defaultFilterConfig, ...overrides })
}
