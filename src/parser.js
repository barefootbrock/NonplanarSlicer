function stripComments(line) {
    let i, oldLine = line;
    if ((i = line.indexOf(';')) >= 0) line = line.substring(0, i);
    line = line.replace(/\([^)]*\)/, ""); //Only works for singly nested ()
    return line;
}

function parseLine(line) {
    const re = /([A-Z])([-]?[0-9]*[.]?[0-9]*)/g;

    line = stripComments(line);
    
    let matches, result = {};
    while (matches = re.exec(line)) {
        result[matches[1]] = Number(matches[2]);
    }

    return result;
}

function splitLines(text) {
    return text.split(/\r?\n/);
}

function isMove(line) {
    return (line.G == 1 || line.G == 2) && (line.X !== undefined || line.Y !== undefined || line.Z !== undefined);
}

function isExtrusion(line) {
    return isMove(line) && line.E && line.E > 0;
}

function extractPoints(lines) {
    let X = 0, Y = 0, Z = 0;
    const points = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const data = parseLine(line);
        if (isMove(data)) {
            if (data.X !== undefined) X = data.X;
            if (data.Y !== undefined) Y = data.Y;
            if (data.Z !== undefined) Z = data.Z;
            
            points.push(X, Y, Z);
        }
    }

    return points;
}

function G01(X, Y, Z, E, F) {
    let text = "G1" +
        " X" + X.toFixed(3) + 
        " Y" + Y.toFixed(3) + 
        " Z" + Z.toFixed(3);
    if (E) text += " E" + E.toFixed(6);
    if (F) text += " F" + F.toFixed(0);
    return text;
}

function refineMoves(lines, maxLineLength, firstLine, lastLine) {
    let X = 0, Y = 0, Z = 0, E, F;
    let lastX, lastY, lastZ;
    const newLines = [];
    let count = 0;
    
    lines.map((line) => {
        const data = parseLine(line);
        if (!isMove(data)) {
            newLines.push(line);
            return;
        }

        if (data.X !== undefined) X = data.X;
        if (data.Y !== undefined) Y = data.Y;
        if (data.Z !== undefined) Z = data.Z;
        E = data.E || 0;
        F = data.F;
        count++;

        if (count - 1 < firstLine || count - 1 > lastLine) {
            newLines.push(line);
            lastX = X;
            lastY = Y;
            lastZ = Z;
            return;
        }

        const dist = Math.sqrt((X-lastX)*(X-lastX) + (Y-lastY)*(Y-lastY) + (Z-lastZ)*(Z-lastZ));
        const segments = Math.ceil(dist / maxLineLength);

        for (let i = 1; i <= segments; i++) {
            newLines.push(G01(
                lastX + (X - lastX) / segments * i,
                lastY + (Y - lastY) / segments * i,
                lastZ + (Z - lastZ) / segments * i,
                E / segments,
                (i == 1) ? F : undefined
            ));
        }

        lastX = X;
        lastY = Y;
        lastZ = Z;
    });

    return newLines;
}

function transformPoints(lines, transform, firstLine, lastLine) {
    let X = 0, Y = 0, Z = 0, E, F;
    const newLines = [];
    let count = 0;
    
    lines.map((line) => {
        const data = parseLine(line);
        if (!isMove(data)) {
            newLines.push(line);
            return;
        }

        if (data.X !== undefined) X = data.X;
        if (data.Y !== undefined) Y = data.Y;
        if (data.Z !== undefined) Z = data.Z;
        E = data.E || 0;
        F = data.F;
        count++;

        if (count - 1 < firstLine || count - 1 > lastLine) {
            newLines.push(line);
            return;
        }

        const result = transform(X, Y, Z, E);
        
        newLines.push(G01(
            result.X,
            result.Y,
            result.Z,
            result.E,
            F
        ));
    });

    return newLines;
}

function parseText(text) {
    return splitLines(text).map(
        parseLine
    ).filter(isMove);
}

export { stripComments, parseLine, extractPoints, splitLines, refineMoves, transformPoints };