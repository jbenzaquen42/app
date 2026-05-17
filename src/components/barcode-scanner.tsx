"use client";

import { useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

export function BarcodeScanner({ inputName = "isbn" }: { inputName?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | undefined>(undefined);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("Type an ISBN, or start the camera when you are ready to scan.");
  const [isScanning, setIsScanning] = useState(false);

  async function startScanning() {
    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    try {
      setIsScanning(true);
      setMessage("Camera is scanning. Point it at the ISBN barcode.");
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices.length || !videoRef.current) {
        setMessage("No camera found. Type the ISBN below.");
        setIsScanning(false);
        return;
      }
      controlsRef.current = await reader.decodeFromVideoDevice(devices[0].deviceId, videoRef.current, (result) => {
        if (result && !stopped) {
          setValue(result.getText());
          setMessage("Barcode found. Review the ISBN and look it up.");
          stopped = true;
          setIsScanning(false);
          controlsRef.current?.stop();
          controlsRef.current = undefined;
        }
      });
    } catch {
      setIsScanning(false);
      setMessage("Camera access failed or requires HTTPS. Type the ISBN instead.");
    }
  }

  function stopScanning() {
    controlsRef.current?.stop();
    controlsRef.current = undefined;
    setIsScanning(false);
    setMessage("Camera stopped. You can type the ISBN or start scanning again.");
  }

  return (
    <div className="grid gap-3">
      <video ref={videoRef} className="aspect-video w-full rounded-[1.5rem] bg-[#4b2d22] object-cover" muted playsInline />
      <p className="text-sm text-[#704b38]">{message}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={startScanning} disabled={isScanning}>{isScanning ? "Scanning…" : "Start camera scan"}</button>
        {isScanning ? <button type="button" className="btn-secondary" onClick={stopScanning}>Stop camera</button> : null}
      </div>
      <input className="field-input text-lg" name={inputName} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Type or scan ISBN" />
    </div>
  );
}
