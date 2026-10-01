/*
  ESP32 4-button controller for the local button-game server.
  Wire each normally-open button between a GPIO pin and GND.
  Configure Wi-Fi and server address below, then upload in Arduino IDE.
  No cloud account or Bluetooth pairing is needed.
*/
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_IP = "192.168.1.100";  // Computer's LAN IP from the server startup log.
const uint16_t SERVER_PORT = 8787;
const char* ROOM = "main";
const int BUTTON_PINS[4] = { 25, 26, 27, 32 };
const unsigned long DEBOUNCE_MS = 45;
const unsigned long WIFI_RETRY_MS = 5000;
const unsigned long PRESS_TTL_MS = 500; // A late press must not affect the next game round.
const uint8_t QUEUE_LENGTH = 32;

bool stable[4] = { HIGH, HIGH, HIGH, HIGH };
bool lastRead[4] = { HIGH, HIGH, HIGH, HIGH };
unsigned long changedAt[4] = { 0, 0, 0, 0 };
uint32_t eventCounter = 0;
String deviceId;
QueueHandle_t pressQueue;
struct PressEvent { int button; unsigned long pressedMs; uint32_t counter; };

bool sendPress(const PressEvent& event) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClient client;
  HTTPClient http;
  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/press?room=" + ROOM;
  if (!http.begin(client, url)) return false;
  http.setTimeout(900);
  http.addHeader("Content-Type", "application/json");
  String eventId = deviceId + "-" + String(event.pressedMs) + "-" + String(event.counter);
  String body = "{\"type\":\"press\",\"button\":" + String(event.button) +
    ",\"eventId\":\"" + eventId + "\",\"deviceId\":\"" + deviceId + "\"}";
  int status = http.POST(body);
  if (status != 202 && status != 409) Serial.printf("Send failed: HTTP %d\n", status);
  http.end();
  // A 409 means the server already accepted this event ID before a retry.
  return status == 202 || status == 409;
}

// Network requests run in a separate FreeRTOS task, so scanning continues
// during Wi-Fi stalls and presses on other buttons can enter the queue.
void networkTask(void* parameter) {
  unsigned long nextTry = 0;
  for (;;) {
    unsigned long current = millis();
    if (WiFi.status() != WL_CONNECTED && current >= nextTry) {
      WiFi.reconnect();
      nextTry = current + WIFI_RETRY_MS;
    }
    PressEvent event;
    if (xQueueReceive(pressQueue, &event, pdMS_TO_TICKS(20)) == pdTRUE) {
      if (millis() - event.pressedMs > PRESS_TTL_MS || WiFi.status() != WL_CONNECTED) continue;
      if (!sendPress(event) && millis() - event.pressedMs <= PRESS_TTL_MS) {
        vTaskDelay(pdMS_TO_TICKS(100));
        if (millis() - event.pressedMs <= PRESS_TTL_MS &&
            xQueueSendToFront(pressQueue, &event, 0) != pdTRUE) Serial.println("Button queue full; press skipped");
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 4; i++) pinMode(BUTTON_PINS[i], INPUT_PULLUP);
  deviceId = "esp32-" + String((uint32_t)(ESP.getEfuseMac() & 0xffffffff), HEX);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  pressQueue = xQueueCreate(QUEUE_LENGTH, sizeof(PressEvent));
  xTaskCreate(networkTask, "network", 8192, nullptr, 1, nullptr);
}

void loop() {
  unsigned long current = millis();
  for (int i = 0; i < 4; i++) {
    bool reading = digitalRead(BUTTON_PINS[i]);
    if (reading != lastRead[i]) changedAt[i] = current;
    lastRead[i] = reading;
    if (current - changedAt[i] >= DEBOUNCE_MS && reading != stable[i]) {
      stable[i] = reading;
      if (reading == LOW) {
        PressEvent event = { i, current, ++eventCounter };
        if (xQueueSend(pressQueue, &event, 0) != pdTRUE) Serial.println("Button queue full; press skipped");
      }
    }
  }
  delay(5);
}
