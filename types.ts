export interface Note {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  updatedAt: number;
  createdAt: number;
  isFavorite: boolean;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}