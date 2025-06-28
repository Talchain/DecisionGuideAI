import React, { useEffect, useRef } from 'react';
import { CheckCircle } from 'lucide-react';

interface ConfettiParticle {
  x: number;
  y: number;
  rotation: number;
  color: string;
  scale: number;
  velocity: { x: number; y: number };
  rotationSpeed: number;
}

interface ConfettiConfirmationProps {
  email: string;
}

export default function ConfettiConfirmation({ email }: ConfettiConfirmationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<ConfettiParticle[]>([]);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateCanvasSize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Colors matching the brand
    const colors = ['#4f46e5', '#6366f1', '#818cf8', '#c7d2fe', '#e0e7ff'];

    // Create initial particles
    const createParticles = () => {
      const particleCount = 100;
      particles.current = [];

      for (let i = 0; i < particleCount; i++) {
        particles.current.push({
          x: canvas.width * Math.random(),
          y: -20,
          rotation: Math.random() * 360,
          color: colors[Math.floor(Math.random() * colors.length)],
          scale: 0.5 + Math.random() * 1,
          velocity: {
            x: -1 + Math.random() * 2,
            y: 1 + Math.random() * 3
          },
          rotationSpeed: -4 + Math.random() * 8
        });
      }
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current = particles.current.filter(particle => {
        particle.y += particle.velocity.y;
        particle.x += particle.velocity.x;
        particle.rotation += particle.rotationSpeed;
        particle.velocity.y += 0.1; // Gravity

        // Draw particle
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate((particle.rotation * Math.PI) / 180);
        ctx.scale(particle.scale, particle.scale);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();

        return particle.y < canvas.height + 20;
      });

      if (particles.current.length > 0) {
        animationFrameId.current = requestAnimationFrame(animate);
      }
    };

    // Start animation
    createParticles();
    animate();

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <div className="relative h-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />
      <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-6">
        <div className="p-3 bg-green-100 rounded-full mb-6 animate-bounce">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 animate-fade-in">
          Registration Successful!
        </h2>
        <p className="text-lg text-gray-600 mb-2 animate-fade-in">
          Thank you for your interest in Olumi
        </p>
        <p className="text-gray-500 animate-fade-in">
          We'll notify <span className="font-medium">{email}</span> when early access is available.
        </p>
      </div>
    </div>
  );
}