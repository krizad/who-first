# Agent: WhoFirst (Real-time Socket Edition)

## 🎯 Goal

สร้างระบบ Buzzer ที่ตัดสินผลผ่าน WebSocket แบบ Low-Latency

## 🏗️ Technical Stack

- **Frontend:** React + Tailwind CSS
- **Backend:** Node.js (Socket.io) หรือ Go (Gorilla WebSocket)
- **Real-time:** WebSockets (Bi-directional communication)
- **DB:** Supabase (Log storage)

## 🕹️ Game Flow

1. Host สั่งเริ่มรอบ (Reset State)
2. Player ทุกคนเห็นสถานะปุ่มเป็น "READY"
3. ใครกดคนแรก Message วิ่งถึง Server -> Server Lock ผู้ชนะทันที
4. Server ยิง Event 'winner_announced' กลับไปหาทุกคน
