export interface ISeo {
  title?: string;
  description?: string;
  keywords?: string[];
  robots?: {
    index?: boolean;
    follow?: boolean;
  };
  og?: {
    title?: string;
    description?: string;
    image?: string;
  };
}
