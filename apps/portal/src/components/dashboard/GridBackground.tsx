export const GridBackground = () => (
  <div className="absolute inset-0 opacity-20">
    <div className="absolute inset-0"
      style={{
        backgroundImage: `
          linear-gradient(rgba(24, 178, 176, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(24, 178, 176, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }}
    />
  </div>
);
