export class Controller {
    constructor() {
        this.buttons = {
            A: false,
            B: false,
            SELECT: false,
            START: false,
            UP: false,
            DOWN: false,
            LEFT: false,
            RIGHT: false,
        };
        this.strobe = 0;
        this.index = 0;
    }

    read() {
        if (this.index > 7) {
            return 1;
        }

        const value = this.getButtonState(this.index);
        if (this.strobe === 0) {
            this.index++;
        }
        return value;
    }

    write(data) {
        this.strobe = data & 1;
        if (this.strobe === 1) {
            this.index = 0;
        }
    }

    getButtonState(index) {
        switch (index) {
            case 0: return this.buttons.A ? 1 : 0;
            case 1: return this.buttons.B ? 1 : 0;
            case 2: return this.buttons.SELECT ? 1 : 0;
            case 3: return this.buttons.START ? 1 : 0;
            case 4: return this.buttons.UP ? 1 : 0;
            case 5: return this.buttons.DOWN ? 1 : 0;
            case 6: return this.buttons.LEFT ? 1 : 0;
            case 7: return this.buttons.RIGHT ? 1 : 0;
            default: return 0;
        }
    }

    setButtonState(button, value) {
        this.buttons[button] = value;
    }
}
