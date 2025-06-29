# 🎮 MiniAgar - Browser Spiel mit Computer Bots

Ein browserbasiertes Agar.io-ähnliches Spiel für lokale Tests gegen intelligente Computer-Bots.

![Game Preview](https://img.shields.io/badge/Status-In%20Development-yellow)
![Platform](https://img.shields.io/badge/Platform-Browser-blue)
![Controls](https://img.shields.io/badge/Controls-Mouse%20%2B%20Keyboard-green)

---

## 📖 Spielbeschreibung

**MiniAgar** ist ein Zellen-basiertes Multiplayer-Spiel, in dem Sie eine kleine Zelle steuern und durch das Fressen von Nahrung und kleineren Gegnern wachsen. Das Ziel ist es, so groß wie möglich zu werden, während Sie größeren Zellen ausweichen.

### 🎯 Spielziel
- **Überleben** und so lange wie möglich am Leben bleiben
- **Wachsen** durch das Sammeln von Nahrung und das Fressen kleinerer Zellen
- **Dominieren** Sie das Spielfeld und werden Sie zur größten Zelle
- **Vermeiden** Sie größere Gegner, die Sie fressen können

---

## 🚀 Schnellstart

### Voraussetzungen
- Moderner Webbrowser (Chrome, Firefox, Safari, Edge)
- JavaScript aktiviert
- Keine Installation erforderlich

### Spiel starten
1. Laden Sie die `index.html` Datei in Ihren Browser
2. Geben Sie Ihren gewünschten Spielernamen ein
3. Klicken Sie auf "Spiel starten"
4. Verwenden Sie Maus oder Pfeiltasten zur Steuerung

---

## 🎮 Steuerung

### 🖱️ Maus-Steuerung (Primär)
- **Bewegung**: Bewegen Sie die Maus - Ihre Zelle folgt dem Mauszeiger
- **Geschwindigkeit**: Automatisch - größere Zellen bewegen sich langsamer
- **Präzision**: Höchste Genauigkeit für competitive Gameplay

### ⌨️ Tastatur-Steuerung (Alternative)
- **↑ ↓ ← →**: Pfeiltasten für Bewegung in 8 Richtungen
- **WASD**: Alternative Bewegungstasten
- **ESC**: Spielmenü öffnen/schließen
- **R**: Spiel neu starten (nach Game Over)

### 🔮 Geplante Funktionen (zukünftige Updates)
- **LEERTASTE**: Zelle teilen (Split-Mechanik)
- **W**: Masse abschießen (Feed anderen Spielern)
- **E**: Boost aktivieren (Geschwindigkeitsschub)

---

## 🧠 Computer-Bot Verhalten

Das Spiel enthält **4 verschiedene Bot-Typen** mit unterschiedlichen Strategien:

### 🤖 Bot-Kategorien

#### 1. **Aggressive Bots** (Rot)
- **Verhalten**: Jagen aktiv andere Zellen
- **Strategie**: Fokus auf PvP-Kämpfe
- **Schwierigkeit**: Hoch
- **Erkennung**: Bewegen sich zielgerichtet auf Gegner zu

#### 2. **Passive Bots** (Blau)
- **Verhalten**: Sammeln hauptsächlich Nahrung
- **Strategie**: Vermeiden Konflikte, fokussieren auf Wachstum
- **Schwierigkeit**: Niedrig-Mittel
- **Erkennung**: Weichen größeren Zellen aus

#### 3. **Balanced Bots** (Grün)
- **Verhalten**: Mischung aus Jagen und Sammeln
- **Strategie**: Adaptiv je nach Größe und Situation
- **Schwierigkeit**: Mittel-Hoch
- **Erkennung**: Intelligente Zielwahl

#### 4. **Opportunistische Bots** (Gelb)
- **Verhalten**: Nutzen günstige Gelegenheiten
- **Strategie**: Warten auf schwache/geteilte Gegner
- **Schwierigkeit**: Mittel
- **Erkennung**: Lauern in der Nähe von Kämpfen

### 🎯 Bot-KI Features
- **Dynamische Zielauswahl**: Bots wählen Ziele basierend auf Größenverhältnis
- **Fluchtmechanismus**: Automatisches Ausweichen vor größeren Bedrohungen
- **Gruppenverhalten**: Bots können zusammenarbeiten oder sich bekämpfen
- **Lernfähigkeit**: Anpassung der Strategie basierend auf Spielverlauf

---

## 🎲 Spielmechanik

### 📏 Größensystem
```
Startzelle: Radius 10px
Nahrung: Radius 3px
Maximalgröße: Radius 100px (theoretisch unbegrenzt)
```

### 🍎 Nahrungssystem
- **Kleine Punkte**: +1 Masse pro Nahrung
- **Spawn-Rate**: 5 neue Nahrung pro Sekunde
- **Verteilung**: Gleichmäßig über das Spielfeld
- **Farben**: Zufällige bunte Kreise

### ⚔️ Kampfsystem
- **Fress-Regel**: Sie können Zellen fressen, die mindestens **20% kleiner** sind
- **Masse-Transfer**: Sie erhalten **80%** der gefressenen Masse
- **Geschwindigkeitsmalus**: Je größer die Zelle, desto langsamer die Bewegung
- **Formel**: `Geschwindigkeit = BaseSpeed / sqrt(Masse)`

### 🏆 Punktesystem
- **Nahrung fressen**: +1 Punkt
- **Bot fressen**: +10 Punkte pro gefressenem Bot
- **Überlebenszeit**: +1 Punkt pro 5 Sekunden
- **Größenbonus**: Zusätzliche Punkte basierend auf aktueller Zellgröße

---

## 🗺️ Spielfeld

### 📐 Dimensionen
- **Spielfeldgröße**: 2000x2000 Pixel
- **Sichtbare Fläche**: Abhängig von Zellgröße (Zoom-Effekt)
- **Kamera**: Folgt automatisch der Spielerzelle
- **Grenzen**: Unsichtbare Wände verhindern das Verlassen des Spielfelds

### 🌍 Umgebung
- **Hintergrund**: Dunkler Verlauf mit Grid-Pattern
- **Nahrungsverteilung**: Gleichmäßig über gesamtes Spielfeld
- **Bot-Spawns**: Zufällige Positionen mit Mindestabstand zu Spieler

---

## 📊 Benutzeroberfläche

### 🎯 HUD-Elemente
- **Spielerinformationen** (oben links):
  - Aktueller Name
  - Punktestand
  - Aktuelle Masse
  - Überlebenszeit

- **Leaderboard** (oben rechts):
  - Top 5 größte Zellen
  - Live-Updates
  - Spieler vs. Bot Kennzeichnung

- **Mini-Map** (unten rechts):
  - Übersicht über Spielfeldpositionen
  - Vereinfachte Darstellung aller Zellen
  - Zoom-Indikator

### 🎨 Visuelle Features
- **Smooth Animation**: 60 FPS Rendering
- **Glow-Effekte**: Leuchtende Umrandungen für Zellen
- **Partikel-Effekte**: Beim Fressen und Wachsen
- **Responsive Design**: Automatische Anpassung an Bildschirmgröße

---

## ⚙️ Technische Details

### 🛠️ Verwendete Technologien
- **HTML5 Canvas**: Für High-Performance 2D Rendering
- **Vanilla JavaScript**: Keine externen Dependencies
- **CSS3**: Moderne Styling-Features
- **RequestAnimationFrame**: Optimierte 60 FPS Game Loop

### 🔧 Performance-Optimierungen
- **Object Pooling**: Wiederverwendung von Spiel-Objekten
- **Spatial Partitioning**: Effiziente Kollisionserkennung
- **Viewport Culling**: Nur sichtbare Objekte werden gerendert
- **Delta Time**: Framerate-unabhängige Bewegung

### 📱 Browser-Kompatibilität
| Browser | Version | Status |
|---------|---------|---------|
| Chrome | 90+ | ✅ Vollständig unterstützt |
| Firefox | 88+ | ✅ Vollständig unterstützt |
| Safari | 14+ | ✅ Vollständig unterstützt |
| Edge | 90+ | ✅ Vollständig unterstützt |

---

## 🚧 Entwicklungsroadmap

### ✅ Aktueller Stand (v0.1)
- [x] Grundlegende Spielmechanik
- [x] Maus- und Tastatursteuerung
- [x] 4 verschiedene Bot-Typen
- [x] Kollisionserkennung
- [x] Punktesystem
- [x] Responsive UI

### 🔄 In Entwicklung (v0.2)
- [ ] Mobile Touch-Steuerung
- [ ] Split-Mechanik (Zelle teilen)
- [ ] Masse-Schuss Feature
- [ ] Verbesserte Bot-KI
- [ ] Sound-Effekte

### 🎯 Geplant (v0.3+)
- [ ] Multiplayer-Modus (lokales Netzwerk)
- [ ] Verschiedene Spielmodi
- [ ] Anpassbare Bot-Schwierigkeit
- [ ] Achievements/Erfolge
- [ ] Replay-System

### 🌟 Fernziele (v1.0+)
- [ ] Online-Multiplayer
- [ ] Clan-System
- [ ] Ranglisten
- [ ] Custom Skins
- [ ] Tournament-Modus

---

## 🎮 Spieltipps & Strategien

### 🏃 Für Anfänger
1. **Bleiben Sie in Bewegung**: Stillstehen macht Sie zur leichten Beute
2. **Sammeln Sie zuerst Nahrung**: Werden Sie groß genug, um Bots zu jagen
3. **Beobachten Sie die Größenverhältnisse**: Greifen Sie nur kleinere Zellen an
4. **Nutzen Sie die Spielfeldränder**: Weniger Fluchtrichtungen für Gegner

### ⚔️ Für Fortgeschrittene
1. **Vorhersagen Sie Bot-Bewegungen**: Studieren Sie Bot-Verhalten
2. **Nutzen Sie Geschwindigkeitsunterschiede**: Kleinere Zellen sind schneller
3. **Timing ist alles**: Warten Sie auf den perfekten Moment zum Angriff
4. **Kontrollieren Sie das Zentrum**: Mehr Nahrung spawnt in der Spielfeldmitte

### 🧠 Profi-Strategien
1. **Baiting**: Locken Sie Bots in Fallen
2. **Zone Control**: Dominieren Sie bestimmte Spielfeldbereiche
3. **Risk Management**: Kalkulieren Sie jedes Risiko vor dem Angriff
4. **Endgame Planning**: Strategien für die letzten überlebenden Zellen

---

## 🐛 Bekannte Probleme & Lösungen

### ⚠️ Häufige Probleme
| Problem | Ursache | Lösung |
|---------|---------|---------|
| Ruckelnde Bewegung | Niedriger Framerate | Browser-Tabs schließen, Hardware-Beschleunigung aktivieren |
| Verzögerte Eingabe | Browser-Optimierung | F5 drücken, anderen Browser testen |
| Unsichtbare Zellen | Cache-Problem | Strg+F5 (Hard Refresh) |

### 🔧 Fehlerbehebung
1. **Browser-Cache leeren**: Strg+Shift+Delete
2. **JavaScript-Konsole prüfen**: F12 → Console Tab
3. **Zoom zurücksetzen**: Strg+0
4. **Vollbild-Modus**: F11 für bessere Performance

---

## 📈 Statistiken & Analytics

### 🎯 Gameplay-Metriken
- **Durchschnittliche Spielzeit**: Wird lokal gespeichert
- **Höchste erreichte Masse**: Personal Best Tracking
- **Bot-Eliminierungen**: Anzahl gefressener Bots
- **Nahrungseffizienz**: Nahrung pro Minute

### 📊 Performance-Monitoring
- **FPS-Counter**: Live-Anzeige der Framerate
- **Lag-Erkennung**: Automatische Performance-Anpassung
- **Memory Usage**: Speicherverbrauch-Überwachung

---

## 🤝 Entwicklung & Beitrag

### 💻 Lokale Entwicklung
```bash
# Keine Installation erforderlich
# Einfach index.html im Browser öffnen

# Für Live-Entwicklung (optional):
npx live-server
```

### 🐛 Bug Reports
Bitte melden Sie Bugs mit folgenden Informationen:
- Browser und Version
- Betriebssystem
- Schritte zur Reproduktion
- Screenshots/Videos falls möglich

### 💡 Feature-Requests
Neue Feature-Ideen sind willkommen! Bevorzugte Kategorien:
- Gameplay-Mechaniken
- UI/UX Verbesserungen
- Performance-Optimierungen
- Accessibility-Features

---

## 📄 Lizenz & Credits

### 📜 Lizenz
Dieses Projekt steht unter der MIT-Lizenz. Siehe `LICENSE` Datei für Details.

### 🙏 Credits
- **Inspiration**: Agar.io (Original-Spiel)
- **Entwicklung**: [Ihr Name]
- **Testing**: Community Feedback
- **Assets**: Selbst erstellt

### 🔗 Externe Ressourcen
- Canvas API Dokumentation: [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- Game Development Patterns: [Game Programming Patterns](https://gameprogrammingpatterns.com/)

---

## 📞 Support & Community

### 💬 Kontakt
- **Issues**: GitHub Issues Tab
- **Diskussionen**: GitHub Discussions
- **Updates**: Watch/Star das Repository

### 🌐 Community
- **Discord**: [Geplant für v1.0]
- **Reddit**: [Community Subreddit geplant]
- **Twitter**: [Updates und News]

---

## ⭐ Changelog

### v0.1.0 (Aktuell)
- ✨ Initiale Spielmechanik implementiert
- 🤖 4 verschiedene Bot-Typen hinzugefügt
- 🎮 Maus- und Tastatursteuerung
- 📊 Grundlegendes UI und Leaderboard
- 🏆 Punktesystem implementiert

### v0.0.1 (Proof of Concept)
- 🎯 Grundlegende Canvas-Rendering
- 🔵 Einfache Zellbewegung
- 🍎 Nahrungssystem

---

**🎮 Viel Spaß beim Spielen und möge die größte Zelle gewinnen! 🏆**# MiniAgar2
# MiniAgar2
# MiniAgar2
