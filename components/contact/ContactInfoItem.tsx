import { memo } from "react";

type ContactItemProps = {
  icon: React.ReactNode;
  title: string;
  content: string | React.ReactNode;
};

function ContactInfoItem({ icon, title, content }: ContactItemProps) {
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <div className="bg-linear-to-r from-brand to-accent-ds p-2 sm:p-3 rounded-xl shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-base sm:text-lg font-semibold dark:text-white text-body-primary mb-1 transition-colors duration-300">
          {title}
        </h3>
        {typeof content === "string" ? (
          <p className="text-body-secondary transition-colors duration-300">
            {content}
          </p>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

export default memo(ContactInfoItem);
