export default function AboutHero() {
  return (
    <div className="text-center mb-8 sm:mb-12 md:mb-16">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6">
        <span className="bg-linear-to-r from-brand to-accent-ds bg-clip-text text-transparent">
          About Us
        </span>
      </h1>
      <p className="text-lg sm:text-xl text-body-secondary max-w-3xl mx-auto leading-relaxed transition-colors duration-300 px-4 sm:px-0">
        Welcome to DreamShop, your destination for modern shopping and quality
        products. We bring together trending items, trusted brands, and a
        seamless shopping experience designed for everyone.
      </p>
    </div>
  );
}
