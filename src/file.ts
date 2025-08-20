export interface File {
  filename: string
  status: ChangeStatus
  from: string
  to?: string
  similarity?: number
}

export enum ChangeStatus {
  Added = 'added',
  Copied = 'copied',
  Deleted = 'deleted',
  Modified = 'modified',
  Renamed = 'renamed',
  Unmerged = 'unmerged'
}

export const statusMap: Record<'A' | 'M' | 'D' | 'R' | 'C' | 'U', ChangeStatus> = {
  A: ChangeStatus.Added,
  M: ChangeStatus.Modified,
  D: ChangeStatus.Deleted,
  R: ChangeStatus.Renamed,
  C: ChangeStatus.Copied,
  U: ChangeStatus.Unmerged
}
