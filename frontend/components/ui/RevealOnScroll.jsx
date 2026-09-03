import React, { useEffect, useRef, useState } from 'react';

export function RevealOnScroll({
  children,
  className = '',
  delay = 0,
  direction = 'up', // 'up' | 'down' | 'left' | 'right' | 'fade' | 'scale'
  threshold = 0.15,
  as: Component = 'div',
  ...props
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // If IntersectionObserver is not supported (or in test/SSR environment), reveal immediately
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const el = ref.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      if (el) {
        observer.unobserve(el);
      }
    };
  }, [threshold]);

  const getTransformStyles = () => {
    if (isVisible) {
      return {
        opacity: 1,
        transform: 'none',
      };
    }

    switch (direction) {
      case 'up':
        return {
          opacity: 0,
          transform: 'translateY(32px)',
        };
      case 'down':
        return {
          opacity: 0,
          transform: 'translateY(-32px)',
        };
      case 'left':
        return {
          opacity: 0,
          transform: 'translateX(32px)',
        };
      case 'right':
        return {
          opacity: 0,
          transform: 'translateX(-32px)',
        };
      case 'scale':
        return {
          opacity: 0,
          transform: 'scale(0.94)',
        };
      case 'fade':
      default:
        return {
          opacity: 0,
          transform: 'none',
        };
    }
  };

  const style = {
    ...getTransformStyles(),
    transition: `opacity 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
    willChange: 'opacity, transform',
    ...props.style,
  };

  return (
    <Component
      ref={ref}
      className={`reveal-wrapper ${isVisible ? 'is-visible' : ''} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
}

export default RevealOnScroll;
