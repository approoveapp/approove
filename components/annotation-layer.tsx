"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle, Check, X, Send, Maximize2, Crosshair, Eye, EyeOff, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnnotationPin } from "./post-slide";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

interface AnnotationLayerProps {
  imageUrl: string;
  pins: AnnotationPin[];
  onPinCreate?: (
    xPercent: number,
    yPercent: number,
    text: string,
    author: "agency" | "client"
  ) => void | Promise<void>;
  onPinResolve?: (pinId: string, resolved: boolean) => void;
  onPinDelete?: (pinId: string) => void | Promise<void>;
  canAnnotate: boolean;
  author: "agency" | "client";
}

interface DisplaySize {
  width: number;
  height: number;
}

function computeContainedSize(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number
): DisplaySize | null {
  if (containerWidth < 1 || containerHeight < 1 || naturalWidth < 1 || naturalHeight < 1) {
    return null;
  }

  const scale = Math.min(
    containerWidth / naturalWidth,
    containerHeight / naturalHeight
  );

  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  };
}

interface NewPinState {
  x: number;
  y: number;
  isFullscreen: boolean;
}

interface ScreenPoint {
  left: number;
  top: number;
}

function getPinScreenPoint(
  img: HTMLImageElement | null,
  xPercent: number,
  yPercent: number
): ScreenPoint | null {
  if (!img) return null;
  const rect = img.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return {
    left: rect.left + (xPercent / 100) * rect.width,
    top: rect.top + (yPercent / 100) * rect.height,
  };
}

function computePopupPosition(anchor: ScreenPoint): { left: number; top: number } {
  const popupWidth = 288;
  const popupHeight = 210;
  const margin = 12;
  const markerOffset = 36;

  let left = anchor.left - popupWidth / 2;
  let top = anchor.top - popupHeight - markerOffset;

  left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));

  if (top < margin) {
    top = anchor.top + markerOffset;
  }

  top = Math.max(margin, Math.min(top, window.innerHeight - popupHeight - margin));

  return { left, top };
}

function NewPinForm({
  anchor,
  newPinText,
  onChangeText,
  onCreate,
  onCancel,
  inputRef,
  isSubmitting,
}: {
  anchor: ScreenPoint;
  newPinText: string;
  onChangeText: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isSubmitting: boolean;
}) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const { left, top } = computePopupPosition(anchor);

  return (
    <div
      className="fixed z-[10001] w-72 animate-in fade-in zoom-in-95 duration-150"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-background rounded-xl border shadow-2xl overflow-hidden">
        <div className="px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5">
          <MessageCircle className="h-3 w-3" />
          {tr("Nova anotação", "New annotation")}
        </div>
        <div className="p-3 space-y-2">
          <textarea
            ref={inputRef}
            value={newPinText}
            onChange={(e) => onChangeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onCreate(); }
              if (e.key === "Escape") onCancel();
            }}
            placeholder={tr("Descreva o ajuste necessário...", "Describe the change needed...")}
            className="w-full text-sm px-3 py-2 border rounded-lg bg-muted/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={2}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={onCreate}
              disabled={!newPinText.trim() || isSubmitting}
            >
              <Send className="h-3 w-3 mr-1" /> {isSubmitting ? tr("Enviando...", "Sending...") : tr("Enviar", "Send")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function computePinDetailPosition(anchor: ScreenPoint): { left: number; top: number } {
  const popupWidth = 288;
  const popupHeight = 200;
  const margin = 12;
  const sideOffset = 36;

  let left = anchor.left + sideOffset;
  let top = anchor.top - popupHeight / 2;

  if (left + popupWidth > window.innerWidth - margin) {
    left = anchor.left - sideOffset - popupWidth;
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - popupHeight - margin));

  return { left, top };
}

function ActivePinDetail({
  pin,
  anchor,
  onResolve,
  onDelete,
}: {
  pin: AnnotationPin;
  anchor: ScreenPoint;
  onResolve?: (pinId: string, resolved: boolean) => void;
  onDelete?: (pinId: string) => void;
}) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const isResolved = pin.resolved;
  const { left, top } = computePinDetailPosition(anchor);
  const hasActions = onResolve || onDelete;

  const handleDelete = () => {
    if (!onDelete) return;
    if (!window.confirm(tr("Excluir esta anotação?", "Delete this annotation?"))) return;
    onDelete(pin.id);
  };

  return (
    <div
      data-pin-popup
      className="fixed z-[10001] w-72 animate-in fade-in zoom-in-95 duration-150"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-background rounded-xl border shadow-2xl overflow-hidden">
        <div className={`px-3 py-2 text-xs font-semibold text-white flex items-center gap-1.5 ${
          isResolved
            ? "bg-green-500"
            : pin.author === "client" ? "bg-blue-500" : "bg-violet-500"
        }`}>
          <MessageCircle className="h-3 w-3" />
          {pin.author === "client" ? (pin.authorName ?? tr("Cliente", "Client")) : tr("Agência", "Agency")}
          {isResolved && ` - ${tr("Resolvido", "Resolved")}`}
        </div>

        <div className="p-3">
          <p className={`text-sm leading-relaxed ${isResolved ? "text-muted-foreground line-through" : ""}`}>
            {pin.text}
          </p>
        </div>

        {hasActions && (
          <div className="px-3 pb-3 space-y-2">
            {onResolve && (
              isResolved ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-7"
                  onClick={() => onResolve(pin.id, false)}
                >
                  <X className="h-3 w-3 mr-1" /> {tr("Reabrir", "Reopen")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full text-xs h-7 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => onResolve(pin.id, true)}
                >
                  <Check className="h-3 w-3 mr-1" /> {tr("Marcar como resolvido", "Mark as resolved")}
                </Button>
              )
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3 mr-1" /> {tr("Excluir", "Delete")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function dedupePins(pins: AnnotationPin[]): AnnotationPin[] {
  const byId = new Map<string, AnnotationPin>();
  for (const pin of pins) {
    const existing = byId.get(pin.id);
    if (!existing || (pin.resolved && !existing.resolved)) {
      byId.set(pin.id, pin);
    }
  }
  return Array.from(byId.values());
}

function PinCountBadge({
  total,
  pending,
  className,
}: {
  total: number;
  pending: number;
  className: string;
}) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  if (total === 0) return null;

  return (
    <div className={className}>
      <MessageCircle className="h-3.5 w-3.5" />
      <span>
        {total} {total === 1 ? tr("anotação", "annotation") : tr("anotações", "annotations")}
        {pending > 0 && pending < total && (
          <span className="font-normal opacity-90">
            {" "}· {pending} {pending === 1 ? tr("pendente", "pending") : tr("pendentes", "pending")}
          </span>
        )}
      </span>
    </div>
  );
}

function PinMarker({
  pin,
  index,
  isActive,
  onToggle,
}: {
  pin: AnnotationPin;
  index?: number;
  isActive: boolean;
  onToggle: () => void;
}) {
  const isResolved = Boolean(pin.resolved);

  return (
    <button
      type="button"
      data-pin-marker
      data-pin-id={pin.id}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`relative flex items-center justify-center overflow-hidden shadow-lg transition-all hover:scale-110 ${
        isActive && !isResolved ? "scale-110 ring-4 ring-white/40" : ""
      } ${
        isResolved
          ? "w-7 h-7 rounded-full bg-green-600 text-white border border-green-700/80"
          : `w-7 h-7 rounded-full text-white text-xs font-bold ${
              pin.author === "client"
                ? "bg-blue-500 ring-2 ring-blue-500/30"
                : "bg-violet-500 ring-2 ring-violet-500/30"
            }`
      }`}
    >
      {isResolved ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      ) : (
        <span>{index != null ? index + 1 : "?"}</span>
      )}
    </button>
  );
}

export function AnnotationLayer({
  imageUrl,
  pins,
  onPinCreate,
  onPinResolve,
  onPinDelete,
  canAnnotate,
  author,
}: AnnotationLayerProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [activePinAnchor, setActivePinAnchor] = useState<ScreenPoint | null>(null);
  const [newPin, setNewPin] = useState<NewPinState | null>(null);
  const [newPinAnchor, setNewPinAnchor] = useState<ScreenPoint | null>(null);
  const [newPinText, setNewPinText] = useState("");
  const [isCreatingPin, setIsCreatingPin] = useState(false);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [displaySize, setDisplaySize] = useState<DisplaySize | null>(null);
  const [fullscreenSize, setFullscreenSize] = useState<DisplaySize | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const normalImgRef = useRef<HTMLImageElement>(null);
  const fullscreenImgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const closeActivePin = useCallback(() => {
    setActivePinId(null);
    setActivePinAnchor(null);
  }, []);

  const pinsKey = pins.map((p) => p.id).join(",");

  const recalcNormalSize = useCallback(() => {
    const container = containerRef.current;
    const img = normalImgRef.current;
    if (!container || !img?.naturalWidth) return;

    const { width, height } = container.getBoundingClientRect();
    const size = computeContainedSize(width, height, img.naturalWidth, img.naturalHeight);
    if (size) setDisplaySize(size);
  }, []);

  const recalcFullscreenSize = useCallback(() => {
    const img = fullscreenImgRef.current;
    if (!img?.naturalWidth) return;

    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.9;
    const size = computeContainedSize(maxWidth, maxHeight, img.naturalWidth, img.naturalHeight);
    if (size) setFullscreenSize(size);
  }, []);

  useEffect(() => {
    setImageLoaded(false);
    setDisplaySize(null);
    setFullscreenSize(null);
    setAnnotateMode(false);
    setShowPins(true);
    setFullscreen(false);
    closeActivePin();
    setNewPin(null);
    setNewPinAnchor(null);
    setNewPinText("");
  }, [imageUrl, closeActivePin]);

  useEffect(() => {
    if (isCreatingPin) return;
    closeActivePin();
    setNewPin(null);
    setNewPinAnchor(null);
    setNewPinText("");
  }, [pinsKey, closeActivePin, isCreatingPin]);

  useEffect(() => {
    if (!activePinId) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (target.closest("[data-pin-popup]") || target.closest("[data-pin-marker]")) {
        return;
      }
      closeActivePin();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activePinId, closeActivePin]);

  useEffect(() => {
    if (!activePinId || fullscreen) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          closeActivePin();
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activePinId, fullscreen, closeActivePin]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      recalcNormalSize();
    });
    observer.observe(el);

    const intersection = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          recalcNormalSize();
        }
      },
      { threshold: 0.1 }
    );
    intersection.observe(el);

    return () => {
      observer.disconnect();
      intersection.disconnect();
    };
  }, [recalcNormalSize, imageUrl, imageLoaded]);

  useEffect(() => {
    if (fullscreen) {
      recalcFullscreenSize();
      window.addEventListener("resize", recalcFullscreenSize);
      return () => window.removeEventListener("resize", recalcFullscreenSize);
    }
  }, [fullscreen, recalcFullscreenSize, imageLoaded]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  const updateNewPinAnchor = useCallback(() => {
    if (!newPin) {
      setNewPinAnchor(null);
      return;
    }
    const img = newPin.isFullscreen ? fullscreenImgRef.current : normalImgRef.current;
    const point = getPinScreenPoint(img, newPin.x, newPin.y);
    setNewPinAnchor(point);
  }, [newPin]);

  useEffect(() => {
    updateNewPinAnchor();
    if (!newPin) return;

    window.addEventListener("resize", updateNewPinAnchor);
    window.addEventListener("scroll", updateNewPinAnchor, true);
    return () => {
      window.removeEventListener("resize", updateNewPinAnchor);
      window.removeEventListener("scroll", updateNewPinAnchor, true);
    };
  }, [newPin, updateNewPinAnchor, displaySize, fullscreenSize, fullscreen]);

  const updateActivePinAnchor = useCallback(() => {
    if (!activePinId) {
      setActivePinAnchor(null);
      return;
    }
    const pin = pins.find((p) => p.id === activePinId);
    if (!pin) {
      setActivePinAnchor(null);
      return;
    }
    const img = fullscreen ? fullscreenImgRef.current : normalImgRef.current;
    const point = getPinScreenPoint(img, pin.xPercent, pin.yPercent);
    setActivePinAnchor(point);
  }, [activePinId, pins, fullscreen]);

  useEffect(() => {
    updateActivePinAnchor();
    if (!activePinId) return;

    window.addEventListener("resize", updateActivePinAnchor);
    window.addEventListener("scroll", updateActivePinAnchor, true);
    return () => {
      window.removeEventListener("resize", updateActivePinAnchor);
      window.removeEventListener("scroll", updateActivePinAnchor, true);
    };
  }, [activePinId, updateActivePinAnchor, displaySize, fullscreenSize, fullscreen]);

  useEffect(() => {
    if (!activePinId) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeActivePin();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [activePinId, closeActivePin]);

  useEffect(() => {
    if (!newPin) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNewPin(null);
        setNewPinText("");
        setNewPinAnchor(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [newPin]);

  const closeFullscreen = useCallback(() => {
    setFullscreen(false);
    setAnnotateMode(false);
    setNewPin(null);
    setNewPinAnchor(null);
    closeActivePin();
  }, [closeActivePin]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) {
        closeFullscreen();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [fullscreen, closeFullscreen]);

  const getRelativeCoords = useCallback((e: React.MouseEvent, isFullscreenView: boolean) => {
    const img = isFullscreenView ? fullscreenImgRef.current : normalImgRef.current;
    if (!img) return null;

    const rect = img.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x, y };
  }, []);

  const handleImageClick = useCallback((e: React.MouseEvent, isFullscreenView: boolean) => {
    if (!annotateMode) return;
    e.stopPropagation();

    const coords = getRelativeCoords(e, isFullscreenView);
    if (!coords) return;

    const img = isFullscreenView ? fullscreenImgRef.current : normalImgRef.current;
    const anchor = getPinScreenPoint(img, coords.x, coords.y);

    setNewPin({ ...coords, isFullscreen: isFullscreenView });
    setNewPinAnchor(anchor ?? { left: e.clientX, top: e.clientY });
    setNewPinText("");
    closeActivePin();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [annotateMode, getRelativeCoords, closeActivePin]);

  const handleCreatePin = async () => {
    if (!newPin || !newPinText.trim() || !onPinCreate || isCreatingPin) return;

    const { x, y } = newPin;
    const text = newPinText.trim();

    setIsCreatingPin(true);
    try {
      await Promise.resolve(onPinCreate(x, y, text, author));
      setNewPin(null);
      setNewPinAnchor(null);
      setNewPinText("");
    } finally {
      setIsCreatingPin(false);
    }
  };

  const handleCancelPin = () => {
    setNewPin(null);
    setNewPinAnchor(null);
    setNewPinText("");
  };

  const toggleAnnotateMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnnotateMode((prev) => {
      if (prev) setNewPin(null);
      return !prev;
    });
  };

  const toggleShowPins = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPins((prev) => {
      if (prev) {
        closeActivePin();
        setNewPin(null);
        setNewPinAnchor(null);
      }
      return !prev;
    });
  };

  const handlePinToggle = useCallback((pin: AnnotationPin) => {
    if (activePinId === pin.id) {
      closeActivePin();
      return;
    }

    const img = fullscreen ? fullscreenImgRef.current : normalImgRef.current;
    const anchor = getPinScreenPoint(img, pin.xPercent, pin.yPercent);
    setActivePinId(pin.id);
    setActivePinAnchor(anchor);
    setNewPin(null);
    setNewPinAnchor(null);
    setNewPinText("");
  }, [activePinId, fullscreen, closeActivePin]);

  const hasPins = pins.length > 0;

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (annotateMode) return;
    closeActivePin();
    setFullscreen(true);
  };

  const handleNormalImageLoad = () => {
    setImageLoaded(true);
    recalcNormalSize();
  };

  const handleFullscreenImageLoad = () => {
    recalcFullscreenSize();
  };

  const handlePinResolve = useCallback((pinId: string, resolved: boolean) => {
    onPinResolve?.(pinId, resolved);
    closeActivePin();
  }, [onPinResolve, closeActivePin]);

  const handlePinDelete = useCallback((pinId: string) => {
    onPinDelete?.(pinId);
    closeActivePin();
  }, [onPinDelete, closeActivePin]);

  const uniquePins = dedupePins(pins);
  const unresolvedPins = uniquePins.filter((p) => !p.resolved);
  const resolvedPins = uniquePins.filter((p) => p.resolved);
  const allPins = [...unresolvedPins, ...resolvedPins];
  const totalPinCount = uniquePins.length;
  const pendingPinCount = unresolvedPins.length;

  const renderPinCountBadge = (className: string) => (
    showPins ? (
      <PinCountBadge
        total={totalPinCount}
        pending={pendingPinCount}
        className={className}
      />
    ) : null
  );

  const renderPins = () => (
    <>
      {showPins && allPins.map((pin) => {
        const unresolvedIndex = unresolvedPins.findIndex((p) => p.id === pin.id);
        return (
          <div
            key={pin.id}
            className={`absolute ${pin.resolved ? "z-[12]" : "z-10"}`}
            style={{
              left: `${pin.xPercent}%`,
              top: `${pin.yPercent}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <PinMarker
              pin={pin}
              index={unresolvedIndex >= 0 ? unresolvedIndex : undefined}
              isActive={activePinId === pin.id}
              onToggle={() => handlePinToggle(pin)}
            />
          </div>
        );
      })}

      {newPin && (showPins || annotateMode) && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ left: `${newPin.x}%`, top: `${newPin.y}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg ring-4 ring-primary/20 animate-bounce">
            <Crosshair className="h-3.5 w-3.5" />
          </div>
        </div>
      )}
    </>
  );

  const renderActivePinPortal = () => {
    if (!mounted || !activePinId || !activePinAnchor) return null;
    const pin = pins.find((p) => p.id === activePinId);
    if (!pin) return null;

    return createPortal(
      <ActivePinDetail
        pin={pin}
        anchor={activePinAnchor}
        onResolve={onPinResolve ? handlePinResolve : undefined}
        onDelete={onPinDelete ? handlePinDelete : undefined}
      />,
      document.body
    );
  };

  const renderNewPinPortal = () => {
    if (!mounted || !newPin || !newPinAnchor || !(showPins || annotateMode)) return null;

    return createPortal(
      <NewPinForm
        anchor={newPinAnchor}
        newPinText={newPinText}
        onChangeText={setNewPinText}
        onCreate={handleCreatePin}
        onCancel={handleCancelPin}
        inputRef={inputRef}
        isSubmitting={isCreatingPin}
      />,
      document.body
    );
  };

  return (
    <>
      {renderActivePinPortal()}
      {renderNewPinPortal()}
      <div className="relative w-full h-full">
        <div
          ref={containerRef}
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          {displaySize ? (
            <div
              className={`relative shrink-0 ${annotateMode ? "cursor-crosshair" : "cursor-pointer"}`}
              style={{ width: displaySize.width, height: displaySize.height }}
              onClick={(e) => {
                if (annotateMode) {
                  handleImageClick(e, false);
                } else {
                  openFullscreen(e);
                }
              }}
            >
              <img
                ref={normalImgRef}
                src={imageUrl}
                alt=""
                width={displaySize.width}
                height={displaySize.height}
                className="block w-full h-full object-contain rounded select-none"
                draggable={false}
                onLoad={handleNormalImageLoad}
              />
              {!fullscreen && renderPins()}
            </div>
          ) : (
            <img
              ref={normalImgRef}
              src={imageUrl}
              alt=""
              className="sr-only"
              onLoad={handleNormalImageLoad}
            />
          )}
        </div>

        <div className="absolute bottom-3 right-3 z-20 flex gap-1.5">
          {hasPins && (
            <button
              type="button"
              onClick={toggleShowPins}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg backdrop-blur-sm border shadow-sm text-xs transition-colors ${
                showPins
                  ? "bg-background/90 text-muted-foreground hover:text-foreground"
                  : "bg-muted text-foreground border-muted-foreground/30"
              }`}
              title={showPins ? tr("Ocultar marcações", "Hide markers") : tr("Mostrar marcações", "Show markers")}
            >
              {showPins ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              Pins
            </button>
          )}

          <button
            type="button"
            onClick={openFullscreen}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background/90 backdrop-blur-sm border shadow-sm text-xs text-muted-foreground hover:text-foreground transition-colors"
            title={tr("Ampliar imagem", "Enlarge image")}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          {canAnnotate && (
            <button
              type="button"
              onClick={toggleAnnotateMode}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg backdrop-blur-sm border shadow-sm text-xs transition-colors ${
                annotateMode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background/90 text-muted-foreground hover:text-foreground"
              }`}
              title={annotateMode ? tr("Desativar anotações", "Turn off annotations") : tr("Ativar anotações", "Turn on annotations")}
            >
              <Crosshair className="h-3.5 w-3.5" />
              {annotateMode ? tr("Anotando", "Annotating") : tr("Anotar", "Annotate")}
            </button>
          )}
        </div>

        {!fullscreen && renderPinCountBadge(
          "absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500 text-white text-xs font-semibold shadow"
        )}
      </div>

      {mounted && fullscreen && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
          onClick={closeFullscreen}
          role="dialog"
          aria-modal="true"
          aria-label={tr("Visualização ampliada da arte", "Enlarged creative view")}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeFullscreen(); }}
            className="absolute top-4 right-4 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/15 text-white hover:bg-white/25 border border-white/20 transition-colors shadow-lg"
            aria-label={tr("Fechar visualização ampliada", "Close enlarged view")}
            title={tr("Fechar (Esc)", "Close (Esc)")}
          >
            <X className="h-6 w-6" />
          </button>

          {/* Toolbar */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {hasPins && (
              <button
                type="button"
                onClick={toggleShowPins}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showPins
                    ? "bg-white/10 text-white hover:bg-white/20"
                    : "bg-white/20 text-white"
                }`}
                title={showPins ? tr("Ocultar marcações", "Hide markers") : tr("Mostrar marcações", "Show markers")}
              >
                {showPins ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                Pins
              </button>
            )}
            {canAnnotate && (
              <button
                type="button"
                onClick={toggleAnnotateMode}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  annotateMode
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <Crosshair className="h-4 w-4" />
                {annotateMode ? tr("Anotando", "Annotating") : tr("Anotar", "Annotate")}
              </button>
            )}
          </div>

          {renderPinCountBadge(
            "absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-full bg-orange-500 text-white text-sm font-semibold shadow-lg"
          )}

          <div
            className={`relative shrink-0 z-0 ${annotateMode ? "cursor-crosshair" : ""}`}
            style={
              fullscreenSize
                ? { width: fullscreenSize.width, height: fullscreenSize.height }
                : { maxWidth: "90vw", maxHeight: "90vh" }
            }
            onClick={(e) => {
              e.stopPropagation();
              if (annotateMode) handleImageClick(e, true);
            }}
          >
            <img
              ref={fullscreenImgRef}
              src={imageUrl}
              alt=""
              width={fullscreenSize?.width}
              height={fullscreenSize?.height}
              className="block w-full h-full object-contain rounded-lg select-none"
              draggable={false}
              onLoad={handleFullscreenImageLoad}
            />
            {renderPins()}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
