/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Permitir procesamiento de imágenes externas si aplica
  images: {
    unoptimized: true
  }
};

export default nextConfig;
