# Mathematics Extension

The Mathematics extension allows you to write and render mathematical formulas using LaTeX syntax in your speech-to-text editor.

## Usage

To write mathematical expressions, wrap your LaTeX code with dollar signs (`$`):

### Inline Math
```
This is an inline equation: $E = mc^2$
```

### Complex Expressions
```
The quadratic formula: $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$
```

### Greek Letters and Symbols
```
Area of a circle: $A = \pi r^2$
Sum notation: $\sum_{i=1}^{n} x_i$
Integral: $\int_{0}^{\infty} e^{-x} dx = 1$
```

### Fractions and Superscripts
```
Fraction: $\frac{1}{2}$
Superscript: $x^2$
Subscript: $x_1$
```

### Matrices
```
Matrix: $\begin{pmatrix} a & b \\ c & d \end{pmatrix}$
```

## Features

- **Real-time rendering**: Math expressions are rendered as you type
- **Error handling**: Invalid LaTeX shows error styling instead of breaking
- **KaTeX powered**: Uses the fast KaTeX library for rendering
- **Markdown compatible**: Works seamlessly with the markdown editor

## Configuration

The extension is configured with the following default options:

- **Regex pattern**: `/\$([^\$]*)\$/gi` (matches content between dollar signs)
- **Error handling**: Graceful error display for invalid LaTeX
- **Max size**: Limited to prevent performance issues
- **No HTML**: Secure rendering without HTML injection

## Examples in Speech-to-Text

When using the speech-to-text feature, you can say:

- "Dollar E equals M C squared dollar" → `$E = mc^2$`
- "Dollar X equals negative B plus or minus square root B squared minus four A C over two A dollar" → `$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$`
