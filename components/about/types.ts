export type ValueItemProps = {
  emoji: string;
  title: string;
  description: string;
  bgColor: "indigo" | "purple";
};

export type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

export type FeaturesGridListType = {
  title: string;
  description: string;
  iconPaths: string[];
};
