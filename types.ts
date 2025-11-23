export interface Note {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  updatedAt: number;
  isFavorite: boolean;
}

export enum AIActionType {
  SUMMARIZE = 'SUMMARIZE',
  FIX_GRAMMAR = 'FIX_GRAMMAR',
  CONTINUE_WRITING = 'CONTINUE_WRITING',
  GENERATE_TITLE = 'GENERATE_TITLE'
}

export interface AIState {
  isLoading: boolean;
  error: string | null;
}