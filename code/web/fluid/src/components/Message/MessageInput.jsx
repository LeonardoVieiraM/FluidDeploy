import React, { useState, useRef, useCallback } from "react";
import { createWorker } from "tesseract.js";
import apiService from "../../services/apiService";
import SentimentSatisfiedOutlinedIcon from "@mui/icons-material/SentimentSatisfiedOutlined";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";

const MessageInput = ({ disabled, activeConversation, sendImageMessage, sendMessage }) => {
  const [messageText, setMessageText] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImageURL, setSelectedImageURL] = useState(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = useRef(null);

  const preprocessImage = useCallback((imageFile) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const scale = 2;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const color = avg > 140 ? 255 : 0;

          data[i] = color;
          data[i + 1] = color;
          data[i + 2] = color;
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          "image/jpeg",
          1
        );
      };

      img.onerror = (err) => reject(err);
      img.src = URL.createObjectURL(imageFile);
    });
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecione apenas imagens.");
      e.target.value = null;
      return;
    }

    setMessageText("");
    const url = URL.createObjectURL(file);
    setSelectedImageFile(file);
    setSelectedImageURL(url);
    e.target.value = null;

    setIsOcrLoading(true);
    setMessageText("Lendo texto da imagem...");

    try {
      console.log("[OCR]: Pré-processando imagem...");
      const processedImageBlob = await preprocessImage(file);

      console.log("[OCR]: Carregando worker...");
      const worker = await createWorker("por");

      const {
        data: { text },
      } = await worker.recognize(
        processedImageBlob,
        {
          tessjs_create_pdf: "0",
        },
        {
          tessedit_pageseg_mode: "6",
        }
      );

      console.log("[OCR]: Texto encontrado:", text);

      const cleanText = text
        .replace(/\n\s*\n/g, "\n")
        .replace(/([|Il1])\s/g, "")
        .trim();

      setMessageText(cleanText || "[Nenhum texto encontrado]");

      await worker.terminate();
    } catch (err) {
      console.error("Erro no OCR:", err);
      setMessageText("[Erro ao ler a imagem]");
    } finally {
      setIsOcrLoading(false);
    }
  };

  const clearImagePreview = useCallback(() => {
    if (selectedImageURL) URL.revokeObjectURL(selectedImageURL);
    setSelectedImageFile(null);
    setSelectedImageURL(null);
  }, [selectedImageURL]);

  const handleSend = useCallback(async () => {
    if (!activeConversation || (!messageText.trim() && !selectedImageFile)) return;

    try {
      const isGroup = activeConversation.type === "group" || activeConversation.otherUser?.isGroup;
      const sendTarget = isGroup
        ? activeConversation.id || activeConversation.otherUser.id
        : activeConversation.otherUser.id;

      if (selectedImageFile) {
        await sendImageMessage(sendTarget, selectedImageFile, "");
      }

      if (messageText && messageText.trim()) {
        await sendMessage(sendTarget, messageText.trim());
      }

      clearImagePreview();
      setMessageText("");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  }, [activeConversation, messageText, selectedImageFile, sendImageMessage, sendMessage, clearImagePreview]);

  const handleAttachClick = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <footer className="chat-input-footer">
      {/* Image Preview */}
      {selectedImageURL && (
        <div className="image-preview-bar">
          <div className="image-chip">
            <img
              src={selectedImageURL}
              alt="preview"
              className="image-chip-thumb"
            />
            <button
              className="image-chip-remove"
              onClick={clearImagePreview}
              aria-label="Remover imagem"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      <div className="input-row">
        <button className="emoji-btn">
          <SentimentSatisfiedOutlinedIcon />
        </button>

        <button
          className="attach-btn"
          title="Anexar imagem"
          onClick={handleAttachClick}
          disabled={disabled}
        >
          <AttachFileIcon />
        </button>

        <div className="input-field">
          <input
            type="text"
            placeholder="Digite uma mensagem..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled}
          />
        </div>

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={disabled || (!messageText.trim() && !selectedImageFile) || isOcrLoading}
        >
          <SendIcon />
        </button>

        <button className="mic-btn" disabled={disabled}>
          <MicIcon />
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden-file-input"
        accept="image/*"
        disabled={disabled}
      />
    </footer>
  );
};

export default React.memo(MessageInput);