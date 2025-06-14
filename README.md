# 🐜 Turmites Simulation

This project is a modular refactor of the original [Turmites simulation](https://github.com/Marc-R2/turmites) by **[Marc-R2](https://github.com/Marc-R2)**.

The codebase has been broken down into a modular, extensible architecture that includes a dynamic grid, ant logic, rule systems, rendering, and a UI for interactive experimentation.

## ✨ Features
- 🧩 **Modular Core:** Logic for the grid, ants, and rules is cleanly separated.
- ⚙️ **Simulation Engine:** A robust engine for managing timing and the main simulation loop.
- 🖼️ **Interactive Canvas:** A canvas-based renderer with smooth pan and zoom camera controls.
- 🎛️ **Full-Featured UI:** A control panel for selecting presets, adjusting ant count, and modifying all simulation parameters.
- ✅ **Comprehensive Tests:** An integration test suite to ensure stability and correctness.

## 🚀 Getting Started
1. 📥 Clone the repository.
2. 🌐 Open `index.html` in your browser. A local web server is recommended but not required.
3. 🕹️ Use the UI to select presets, adjust parameters, and run the simulation!

## 🧪 Testing
The project includes a suite of integration tests to verify all core functionality.

- **How to Run:**
  1. Open the application (`index.html`) in your browser.
  2. Open the **Developer Console** (usually with F12 or Ctrl+Shift+I).
  3. Type `runTests()` and press Enter.
- **Requirement:** All tests must pass before merging new changes.

## 📁 File Organization
- `core/` – 🧩 Grid, ant, and rule logic.
- `simulation/` – ⚙️ The simulation engine and timing loops.
- `render/` – 🖼️ Canvas drawing and camera logic.
- `ui/` – 🎛️ UI event handlers and control logic.
- `tests/` – 🧪 The integration test suite.
- `docs/` - 📄 Project documentation, including the modularization report.
- `archive/` – 📦 Deprecated files for historical reference.

## 🙏 Acknowledgements
A special note of appreciation to **[Marc-R2](https://github.com/Marc-R2)** for creating the original Turmites simulation. The initial implementation was a clean, well-organized foundation that made the process of modularizing the codebase both straightforward and enjoyable. It's a wonderful demonstration of how complex and beautiful patterns can emerge from simple rules. Thank you for creating and sharing it!

## 📄 License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.