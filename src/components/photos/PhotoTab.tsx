"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useTrip } from "@/lib/trip-context";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import type { TripPhoto } from "@/lib/types";

export default function PhotoTab() {
  const supabase = createClient();
  const { trip, photos, refreshPhotos, currentUserId, isAdmin, loading } = useTrip();

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeletePhoto = useCallback(async (photo: TripPhoto) => {
    if (!confirm('Delete this photo?')) return;
    setDeleting(true);
    try {
      const url = new URL(photo.file_url);
      const pathParts = url.pathname.split('/trip-photos/');
      const storagePath = pathParts[pathParts.length - 1];
      
      if (storagePath) {
        // Decode URI component just in case the filename had special characters
        const decodedStoragePath = decodeURIComponent(storagePath);
        await supabase.storage.from('trip-photos').remove([decodedStoragePath]);
      }
      
      const { error } = await supabase.from('trip_photos').delete().eq('id', photo.id);
      if (error) throw error;
      await refreshPhotos();
      setLightboxIndex(null);
    } catch (err) {
      console.error('Error deleting photo:', err);
    } finally {
      setDeleting(false);
    }
  }, [supabase, refreshPhotos]);

  // ─── Upload ─────────────────────────────────────
  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !trip || !currentUserId) return;

      setUploading(true);

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `${trip.id}/${crypto.randomUUID()}.${ext}`;

          const { error: storageError } = await supabase.storage
            .from("trip-photos")
            .upload(path, file, { cacheControl: "3600", upsert: false });

          if (storageError) throw storageError;

          const {
            data: { publicUrl },
          } = supabase.storage.from("trip-photos").getPublicUrl(path);

          const { error: dbError } = await supabase
            .from("trip_photos")
            .insert({
              trip_id: trip.id,
              uploaded_by: currentUserId,
              file_url: publicUrl,
              file_name: file.name,
              thumbnail_url: null,
            });

          if (dbError) throw dbError;

          // Trigger Google Drive auto-backup in the background
          fetch("/api/drive/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tripId: trip.id,
              fileName: file.name,
              fileUrl: publicUrl,
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                console.error("Google Drive backup failed:", data.error || res.statusText);
              } else {
                console.log("Google Drive backup successful");
              }
            })
            .catch((err) => {
              console.error("Google Drive auto-backup trigger error:", err);
            });
        }

        await refreshPhotos();
        setUploadModalOpen(false);
      } catch (err) {
        console.error("Error uploading photo:", err);
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [supabase, trip, currentUserId, refreshPhotos]
  );

  // ─── Lightbox ───────────────────────────────────
  const openLightbox = (index: number) => setLightboxIndex(index);

  const closeLightbox = () => setLightboxIndex(null);

  const goPrev = () =>
    setLightboxIndex((prev) =>
      prev !== null ? (prev - 1 + photos.length) % photos.length : null
    );

  const goNext = () =>
    setLightboxIndex((prev) =>
      prev !== null ? (prev + 1) % photos.length : null
    );

  // ─── Loading ────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="skeleton mb-4 h-10 w-40" />
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="skeleton mb-3 rounded-2xl"
              style={{ height: `${150 + (i % 3) * 60}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Empty State ────────────────────────────────
  if (photos.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
              <Camera className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
              <ImageIcon className="h-4 w-4 text-primary" />
            </div>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            No photos yet
          </h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            Capture and share your best moments. Upload photos from your trip
            for everyone to enjoy.
          </p>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="btn-glow flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload First Photo
          </button>
        </div>

        {/* Upload Modal */}
        <UploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onUpload={handleUpload}
          uploading={uploading}
          fileInputRef={fileInputRef}
        />
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Photos</h2>
          <span className="badge badge-info">
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
          </span>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="btn-glow flex items-center gap-2 text-sm"
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>
      </div>

      {/* Masonry Grid */}
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            onOpen={openLightbox}
          />
        ))}
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
        uploading={uploading}
        fileInputRef={fileInputRef}
      />

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Delete Button */}
          {(currentUserId === photos[lightboxIndex].uploaded_by || isAdmin) && (
            <button
              onClick={() => handleDeletePhoto(photos[lightboxIndex])}
              disabled={deleting}
              className="absolute right-16 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
              title="Delete photo"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}

          {/* Prev */}
          {photos.length > 1 && (
            <button
              onClick={goPrev}
              className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Image */}
          <div className="max-h-[85vh] max-w-[90vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightboxIndex].file_url}
              alt={photos[lightboxIndex].file_name}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>

          {/* Next */}
          {photos.length > 1 && (
            <button
              onClick={goNext}
              className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Caption */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-black/50 px-4 py-2 text-center backdrop-blur-sm">
            <p className="text-sm font-medium text-white">
              {photos[lightboxIndex].file_name}
            </p>
            <p className="text-xs text-white/60">
              {photos[lightboxIndex].uploaded_by_user?.full_name ?? "Unknown"} ·{" "}
              {formatDistanceToNow(
                new Date(photos[lightboxIndex].uploaded_at),
                { addSuffix: true }
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Photo Card ─────────────────────────────────
function PhotoCard({
  photo,
  index,
  onOpen,
}: {
  photo: TripPhoto;
  index: number;
  onOpen: (index: number) => void;
}) {
  return (
    <div
      className={cn(
        "group relative mb-3 cursor-pointer overflow-hidden rounded-2xl",
        "transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
      )}
      style={{ animationDelay: `${index * 0.03}s` }}
      onClick={() => onOpen(index)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.file_url}
        alt={photo.file_name}
        className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-2">
            {photo.uploaded_by_user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.uploaded_by_user.avatar_url}
                alt={photo.uploaded_by_user.full_name}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="avatar avatar-sm text-[10px]">
                {getInitials(
                  photo.uploaded_by_user?.full_name ?? "U"
                )}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">
                {photo.uploaded_by_user?.full_name ?? "Unknown"}
              </p>
              <p className="text-[10px] text-white/60">
                {formatDistanceToNow(new Date(photo.uploaded_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Modal ───────────────────────────────
function UploadModal({
  isOpen,
  onClose,
  onUpload,
  uploading,
  fileInputRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: FileList | null) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold gradient-text">Upload Photos</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all",
            "border-border hover:border-primary/50 hover:bg-primary/5",
            uploading && "pointer-events-none opacity-50"
          )}
        >
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <p className="mb-1 text-sm font-medium text-foreground">
            {uploading ? "Uploading..." : "Click to select photos"}
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WEBP up to 10MB each
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
            disabled={uploading}
          />
        </label>

        {/* Uploading indicator */}
        {uploading && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              Uploading photos...
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
