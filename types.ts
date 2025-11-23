export interface Note {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  updatedAt: number;
  createdAt: number;
  isFavorite: boolean;
}

export enum AIActionType {
  SUMMARIZE = 'SUMMARIZE',
  FIX_GRAMMAR = 'FIX_GRAMMAR',
  CONTINUE_WRITING = 'CONTINUE_WRITING',
  GENERATE_TITLE = 'GENERATE_TITLE',
  CUSTOM = 'CUSTOM'
}

export interface AIState {
  isLoading: boolean;
  error: string | null;
}

export interface CustomPrompt {
  id: string;
  name: string;
  template: string; // Use {{text}} for placement
  actionType: 'replace' | 'append';
}