import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`px-4 py-2 rounded-md font-semibold ${
          variant === "primary"
            ? "bg-white text-black hover:bg-gray-200"
            : "bg-gray-800 text-white hover:bg-gray-700"
        } ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
