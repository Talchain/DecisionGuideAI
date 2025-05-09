interface ProConItem {
  id: string;
  content: string;
  score: number;
  createdAt: string;
}

export interface Option {
  id: string;
  name: string;
  pros: ProConItem[];
  cons: ProConItem[];
  createdAt: string;
}

export interface OptionScore {
  name: string;
  prosScore: number;
  consScore: number;
  totalScore: number;
}

interface APIOption {
  name: string;
  pros: string[];
  cons: string[];
}