import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

export const MIN_IMAGE_ZOOM = 25;
export const MAX_IMAGE_ZOOM = 300;
export const IMAGE_ZOOM_STEP = 25;

export const changeImageZoom = (current: number, direction: 'in' | 'out' | 'reset'): number => {
  if (direction === 'reset') return 100;
  return Math.max(MIN_IMAGE_ZOOM, Math.min(MAX_IMAGE_ZOOM,
    current + (direction === 'in' ? IMAGE_ZOOM_STEP : -IMAGE_ZOOM_STEP)));
};

interface PanStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
}

export const getDraggedScrollPosition = (start: PanStart, clientX: number, clientY: number) => ({
  left: start.scrollLeft - (clientX - start.clientX),
  top: start.scrollTop - (clientY - start.clientY),
});

interface ImagePreviewProps {
  url: string;
  filename: string;
  onError: () => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ url, filename, onError }) => {
  const [zoom, setZoom] = useState(100);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [canPan, setCanPan] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<PanStart | null>(null);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !naturalSize) return;
    const availableWidth = Math.max(1, viewport.clientWidth - 24);
    const availableHeight = Math.max(1, window.innerHeight * 0.52 - 24);
    const fit = Math.min(1, availableWidth / naturalSize.width, availableHeight / naturalSize.height);
    setBaseSize({ width: naturalSize.width * fit, height: naturalSize.height * fit });
  }, [naturalSize]);

  useEffect(() => {
    measure();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measure]);

  const displayWidth = baseSize ? Math.round(baseSize.width * zoom / 100) : undefined;
  const displayHeight = baseSize ? Math.round(baseSize.height * zoom / 100) : undefined;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      setCanPan(viewport.scrollWidth > viewport.clientWidth || viewport.scrollHeight > viewport.clientHeight);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayWidth, displayHeight]);

  useEffect(() => {
    panStartRef.current = null;
    setIsDragging(false);
    setZoom(100);
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
  }, [url]);

  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panStartRef.current?.pointerId !== event.pointerId) return;
    panStartRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resetImage = () => {
    panStartRef.current = null;
    setIsDragging(false);
    setZoom(100);
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
  };

  return <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-center justify-end gap-2" aria-label="เครื่องมือขยายภาพ">
      <button type="button" onClick={() => setZoom((value) => changeImageZoom(value, 'out'))} disabled={zoom <= MIN_IMAGE_ZOOM} aria-label="ย่อภาพ" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
      <output aria-live="polite" className="min-w-14 text-center text-xs font-semibold text-slate-700">{zoom}%</output>
      <button type="button" onClick={() => setZoom((value) => changeImageZoom(value, 'in'))} disabled={zoom >= MAX_IMAGE_ZOOM} aria-label="ขยายภาพ" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
      <button type="button" onClick={resetImage} disabled={zoom === 100} className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />รีเซ็ต</button>
    </div>
    <div ref={viewportRef} className={`max-h-[56vh] min-h-40 min-w-0 select-none overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 ${isDragging ? 'cursor-grabbing' : canPan ? 'cursor-grab touch-none' : ''}`} aria-label="พื้นที่เลื่อนดูภาพ"
      onPointerDown={(event) => {
        if (!canPan || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        panStartRef.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          scrollLeft: event.currentTarget.scrollLeft,
          scrollTop: event.currentTarget.scrollTop,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
      }}
      onPointerMove={(event) => {
        const start = panStartRef.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const next = getDraggedScrollPosition(start, event.clientX, event.clientY);
        event.currentTarget.scrollLeft = next.left;
        event.currentTarget.scrollTop = next.top;
      }}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={(event) => {
        if (panStartRef.current?.pointerId !== event.pointerId) return;
        panStartRef.current = null;
        setIsDragging(false);
      }}
    >
      <div className="flex min-h-36 min-w-full items-center justify-center" style={{ width: displayWidth, height: displayHeight ? Math.max(144, displayHeight) : undefined }}>
        <img src={url} alt={`ตัวอย่างไฟล์ ${filename}`} draggable={false} onDragStart={(event) => event.preventDefault()} onError={onError} onLoad={(event) => {
          setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
        }} className="block max-h-[52vh] max-w-full object-contain" style={baseSize ? { width: displayWidth, height: displayHeight, maxWidth: 'none', maxHeight: 'none' } : undefined} />
      </div>
    </div>
  </div>;
};
