import { useCallback, useEffect, useState } from 'react';

export function useKeyboardBottomInset({
  inputAreaRef,
  listRef,
  scrollToBottom,
}: {
  inputAreaRef: React.RefObject<HTMLDivElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  scrollToBottom: () => void;
}): {
  inputBottom: number;
  applyKeyboardLayout: (keyboardHeight: number) => void;
  handleInputFocus: (inputRef: React.RefObject<HTMLTextAreaElement | null>) => void;
} {
  const [inputBottom, setInputBottom] = useState(0);

  const applyKeyboardLayout = useCallback(
    (keyboardHeight: number) => {
      const inputAreaHeight = inputAreaRef.current?.offsetHeight || 72;

      if (keyboardHeight > 0) {
        const totalBottomSpace = keyboardHeight + inputAreaHeight;
        setInputBottom(keyboardHeight);
        if (listRef.current) {
          listRef.current.style.paddingBottom = `${totalBottomSpace + 8}px`;
        }
      } else {
        setInputBottom(0);
        if (listRef.current) {
          listRef.current.style.paddingBottom = `${inputAreaHeight + 8}px`;
        }
      }

      requestAnimationFrame(() => scrollToBottom());
    },
    [inputAreaRef, listRef, scrollToBottom]
  );

  // Keyboard detection (visualViewport).
  useEffect(() => {
    const visualViewport = (window as any).visualViewport;
    if (!visualViewport) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastKeyboardHeight = 0;
    let initialLoadComplete = false;

    const initialTimeout = setTimeout(() => {
      initialLoadComplete = true;
    }, 500);

    const detectKeyboardHeight = (): number => {
      const windowHeight = window.innerHeight;
      const viewportHeight = visualViewport.height;
      const viewportBottom = visualViewport.offsetTop + viewportHeight;
      return Math.max(0, windowHeight - viewportBottom);
    };

    const updateLayout = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const keyboardHeight = detectKeyboardHeight();
        if (initialLoadComplete && Math.abs(keyboardHeight - lastKeyboardHeight) > 10) {
          lastKeyboardHeight = keyboardHeight;
          applyKeyboardLayout(keyboardHeight);
        }
      }, 50);
    };

    visualViewport.addEventListener('resize', updateLayout);
    visualViewport.addEventListener('scroll', updateLayout);
    window.addEventListener('resize', updateLayout);

    updateLayout();

    return () => {
      clearTimeout(initialTimeout);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      visualViewport.removeEventListener('resize', updateLayout);
      visualViewport.removeEventListener('scroll', updateLayout);
      window.removeEventListener('resize', updateLayout);
    };
  }, [applyKeyboardLayout]);

  // Set initial padding to prevent layout shift.
  useEffect(() => {
    if (listRef.current && inputAreaRef.current) {
      const inputAreaHeight = inputAreaRef.current.offsetHeight || 72;
      listRef.current.style.paddingBottom = `${inputAreaHeight + 8}px`;
    }
  }, [inputAreaRef, listRef]);

  const handleInputFocus = useCallback(
    (inputRef: React.RefObject<HTMLTextAreaElement | null>) => {
      if (inputRef.current) {
        inputRef.current.removeAttribute('readonly');
      }

      const detectAndApply = () => {
        const visualViewport = (window as any).visualViewport;
        if (visualViewport) {
          const windowHeight = window.innerHeight;
          const viewportHeight = visualViewport.height;
          const viewportBottom = visualViewport.offsetTop + viewportHeight;
          const keyboardHeight = Math.max(0, windowHeight - viewportBottom);
          applyKeyboardLayout(keyboardHeight);
        }
      };

      setTimeout(detectAndApply, 50);
      setTimeout(detectAndApply, 150);
      scrollToBottom();
    },
    [applyKeyboardLayout, scrollToBottom]
  );

  return { inputBottom, applyKeyboardLayout, handleInputFocus };
}

