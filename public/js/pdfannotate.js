var PDFAnnotate = function (container_id, url, options = {}) {
  this.number_of_pages = 0;
  this.pages_rendered = 0;
  this.active_tool = 1; // 1 - Free hand, 2 - Text, 3 - Arrow, 4 - Rectangle
  this.fabricObjects = [];
  this.fabricObjectsData = [];
  this.color = "#212121";
  this.borderColor = "#000000";
  this.borderSize = 1;
  this.font_size = 16;
  this.active_canvas = 0;
  this.container_id = container_id;
  this.url = url;
  this.pageImageCompression = options.pageImageCompression
    ? options.pageImageCompression.toUpperCase()
    : "NONE";
  var inst = this;

  this._scale = options.scale || 1;

  var loadingTask = pdfjsLib.getDocument(this.url);
  loadingTask.promise.then(
    function (pdf) {
      var scale = options.scale || 1;
      inst.number_of_pages = pdf.numPages;

      for (var i = 1; i <= pdf.numPages; i++) {
        pdf.getPage(i).then(function (page) {
          var viewport = page.getViewport({ scale: scale });
          var canvas = document.createElement("canvas");
          document.getElementById(inst.container_id).appendChild(canvas);

          canvas.className = "pdf-canvas";
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          context = canvas.getContext("2d");

          var renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          var renderTask = page.render(renderContext);
          renderTask.promise.then(function () {
            $(".pdf-canvas").each(function (index, el) {
              $(el).attr("id", "page-" + (index + 1) + "-canvas");
            });
            inst.pages_rendered++;
            if (inst.pages_rendered == inst.number_of_pages) inst.initFabric();
          });
        });
      }
    },
    function (reason) {
      console.error(reason);
    }
  );

  this.initFabric = function () {
    var inst = this;
    let canvases = $("#" + inst.container_id + " canvas");
    canvases.each(function (index, el) {
      var background = el.toDataURL({ format: "png", multiplier: 4 });
      var fabricObj = new fabric.Canvas(el.id, {
        freeDrawingBrush: {
          width: 1,
          color: inst.color,
        },
        selection: false,
      });

      fabricObj.on("path:created", function (options) {
        var path = options.path;
        path.set({
          initialLeft: path.left,
          initialTop: path.top,
          originX: "left",
          originY: "top",
          centeredScaling: false,
          centeredRotation: false,
        });
      });

      fabricObj.on("object:added", function (options) {
        var addedObject = options.target;

        // Check if the added object is a text object
        if (addedObject instanceof fabric.Text) {
          addedObject.set({
            originX: "left",
            originY: "bottom",
            centeredScaling: false,
            centeredRotation: false,
            fontFamily: "helvetica",
          });
        }
      });

      inst.fabricObjects.push(fabricObj);
      if (typeof options.onPageUpdated == "function") {
        fabricObj.on("object:added", function () {
          var oldValue = Object.assign({}, inst.fabricObjectsData[index]);
          inst.fabricObjectsData[index] = fabricObj.toJSON();
          options.onPageUpdated(
            index + 1,
            oldValue,
            inst.fabricObjectsData[index]
          );
        });
      }
      fabricObj.setBackgroundImage(
        background,
        fabricObj.renderAll.bind(fabricObj)
      );
      $(fabricObj.upperCanvasEl).click(function (event) {
        inst.active_canvas = index;
        inst.fabricClickHandler(event, fabricObj);
      });
      fabricObj.on("after:render", function () {
        inst.fabricObjectsData[index] = fabricObj.toJSON();
        fabricObj.off("after:render");
      });

      if (
        index === canvases.length - 1 &&
        typeof options.ready === "function"
      ) {
        options.ready();
      }
    });
  };

  this.fabricClickHandler = function (event, fabricObj) {
    var inst = this;
    if (inst.active_tool == 2) {
      var text = new fabric.IText("Sample text", {
        left:
          event.clientX - fabricObj.upperCanvasEl.getBoundingClientRect().left,
        top:
          event.clientY - fabricObj.upperCanvasEl.getBoundingClientRect().top,
        fill: inst.color,
        fontSize: inst.font_size,
        selectable: true,
      });
      fabricObj.add(text);
      inst.active_tool = 0;
    }
  };
};

PDFAnnotate.prototype.enableSelector = function () {
  var inst = this;
  inst.active_tool = 0;
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = false;
    });
  }
};

PDFAnnotate.prototype.enablePencil = function () {
  var inst = this;
  inst.active_tool = 1;
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = true;
    });
  }
};

PDFAnnotate.prototype.enableAddText = function () {
  var inst = this;
  inst.active_tool = 2;
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = false;
    });
  }
};

PDFAnnotate.prototype.enableRectangle = function () {
  var inst = this;
  var fabricObj = inst.fabricObjects[inst.active_canvas];
  inst.active_tool = 4;
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = false;
    });
  }

  var rect = new fabric.Rect({
    width: 100,
    height: 100,
    left: 100,
    top: 100,
    fill: inst.color,
    // stroke: inst.borderColor,
    stroke: inst.color,
    strokeSize: inst.borderSize,
    originX: "left",
    originY: "bottom",
  });

  rect.centeredRotation = false;

  fabricObj.add(rect);
};

PDFAnnotate.prototype.enableAddArrow = function () {
  var inst = this;
  inst.active_tool = 3;
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = false;

      new Arrow(fabricObj, inst.color, function () {
        inst.active_tool = 0;
      });
    });
  }
};

PDFAnnotate.prototype.addImageToCanvas = function () {
  var inst = this;
  var fabricObj = inst.fabricObjects[inst.active_canvas];

  if (fabricObj) {
    var inputElement = document.createElement("input");
    inputElement.type = "file";
    inputElement.accept = ".jpg,.jpeg,.png,.PNG,.JPG,.JPEG";
    inputElement.onchange = function () {
      var reader = new FileReader();
      reader.addEventListener(
        "load",
        function () {
          inputElement.remove();
          var image = new Image();

          image.onload = function () {
            const ratio = image.width / image.height;
            const width = 300;
            const height = 300 / ratio;

            var fabricImage = new fabric.Image(image, {
              left: width,
              top: height,
              originX: "left",
              originY: "bottom",
            });

            fabricImage.scaleX = width / image.width;
            fabricImage.scaleY = height / image.height;

            fabricObj.add(fabricImage);

            fabricImage.centeredRotation = false;
          };
          image.src = this.result;
        },
        false
      );
      reader.readAsDataURL(inputElement.files[0]);
    };
    document.getElementsByTagName("body")[0].appendChild(inputElement);
    inputElement.click();
  }
};

PDFAnnotate.prototype.deleteSelectedObject = function () {
  var inst = this;
  var activeObject = inst.fabricObjects[inst.active_canvas].getActiveObject();
  if (activeObject) {
    if (confirm("Are you sure ?"))
      inst.fabricObjects[inst.active_canvas].remove(activeObject);
  }
};

// Function to download a PDF file
function downloadPDF(pdfBytes, fileName) {
  var blob = new Blob([pdfBytes], { type: "application/pdf" });
  var url = URL.createObjectURL(blob);

  var a = document.createElement("a");
  a.href = url;
  a.download = fileName;

  // Append the anchor to the body and trigger a click
  document.body.appendChild(a);
  a.click();

  // Remove the anchor from the body
  document.body.removeChild(a);

  // Revoke the object URL to free up resources
  URL.revokeObjectURL(url);
}

const convertCssColorToPdfLib = (cssColorString) => {
  const hexRegex = /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/;

  if (hexRegex.test(cssColorString)) {
    // Convert hex to RGB
    const hexColor = cssColorString.slice(1);
    const r = parseInt(hexColor.slice(0, 2), 16);
    const g = parseInt(hexColor.slice(2, 4), 16);
    const b = parseInt(hexColor.slice(4, 6), 16);
    return PDFLib.rgb(r / 255, g / 255, b / 255);
  }

  const rgbRegex = /rgb\((\d+), (\d+), (\d+)\)/;
  const rgbMatch = cssColorString.match(rgbRegex);

  if (rgbMatch) {
    const [, r, g, b] = rgbMatch.map(Number);

    // Normalize RGB values to the range [0, 1]
    return PDFLib.rgb(r / 255, g / 255, b / 255);
  }

  // Default to black if no match
  return PDFLib.rgb(0, 0, 0);
};

function offsetPaths(
  pathArrays,
  xOffset,
  yOffset,
  scaleX = 1,
  scaleY = 1,
  _scale
) {
  let path = "";
  let point = [];
  for (let i = 0; i < pathArrays.length; i++) {
    for (let j = 0; j < pathArrays[i].length; j++) {
      if (j > 0) {
        let x;
        let y;

        if (j % 2 === 0) {
          x = Math.abs(pathArrays[i][j - 1] - xOffset).toFixed(3);
          y = Math.abs(pathArrays[i][j] - yOffset).toFixed(3);
        } else {
          x = Math.abs(pathArrays[i][j] - xOffset).toFixed(3);
          y = Math.abs(pathArrays[i][j + 1] - yOffset).toFixed(3);
        }

        if (j % 2 === 0) {
          path = `${path} ${point[1] / _scale}`;
        } else {
          point = [x * scaleX, y * scaleY];

          path = `${path} ${point[0] / _scale}`;
        }
      } else {
        path = `${path} ${pathArrays[i][j]}`;
      }
    }
  }

  return path;
}

function findTangentPoints(cx, cy, px, py, radius) {
  // Calculate the slope of the radius
  const slopeRadius = (py - cy) / (px - cx);

  // Calculate the slope of the tangent line
  const slopeTangent = -1 / slopeRadius;

  // Calculate the angle between the radius and the tangent line
  const angle = Math.atan(slopeTangent);

  // Calculate the coordinates of the tangent points

  const tangentPoint1 = {
    x: px - 12 * Math.cos(angle),
    y: py - 12 * Math.sin(angle),
  };

  const tangentPoint2 = {
    x: px + 12 * Math.cos(angle),
    y: py + 12 * Math.sin(angle),
  };

  return [tangentPoint1, tangentPoint2];
}

function findApex(point1, point2, height) {
  // Calculate the midpoint of the base
  const xm = (point1.x + point2.x) / 2;
  const ym = (point1.y + point2.y) / 2;

  // Calculate the unit vector along the base
  const deltaX = point2.x - point1.x;
  const deltaY = point2.y - point1.y;
  const magnitude = Math.sqrt(deltaX ** 2 + deltaY ** 2);
  const u_x = deltaX / magnitude;
  const u_y = deltaY / magnitude;

  // Calculate the perpendicular vector to the base
  const v_x = -u_y;
  const v_y = u_x;

  // Calculate the coordinates of the apex
  const x3 = xm + height * v_x;
  const y3 = ym + height * v_y;

  return { x: x3, y: y3 };
}

function rotatePoint180Degrees(point, center) {
  const xPrime = 2 * center.x - point.x;
  const yPrime = 2 * center.y - point.y;

  return { x: xPrime, y: yPrime };
}

function shortenLine(point1, point2, by) {
  // Extracting coordinates of the two points
  const [x1, y1] = point1;
  const [x2, y2] = point2;

  // Calculate the distance between the two points
  const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

  // Calculate the ratio to decrease the length by 20 units
  const ratio = (distance - by) / distance;

  // Calculate the new coordinates for the shortened line
  const newX = x1 + ratio * (x2 - x1);
  const newY = y1 + ratio * (y2 - y1);

  // Return the coordinates of the shortened point
  return [newX, newY];
}

function rotatePointAround(point, center, angleInDegrees) {
  const [x, y] = point;
  const [cx, cy] = center;

  // Convert angle from degrees to radians
  const angleInRadians = (angleInDegrees * Math.PI) / 180;

  // Translate the point to the origin
  const translatedX = x - cx;
  const translatedY = y - cy;

  // Perform the rotation
  const rotatedX =
    translatedX * Math.cos(angleInRadians) -
    translatedY * Math.sin(angleInRadians);
  const rotatedY =
    translatedX * Math.sin(angleInRadians) +
    translatedY * Math.cos(angleInRadians);

  // Translate the point back to its original position
  const newX = rotatedX + cx;
  const newY = rotatedY + cy;

  // Return the rotated coordinates
  return [newX, newY];
}

function rotatePoint(x, y, angle) {
  const radians = angle * (Math.PI / 180);
  const newX = x * Math.cos(radians) - y * Math.sin(radians);
  const newY = x * Math.sin(radians) + y * Math.cos(radians);
  return [newX, newY];
}

PDFAnnotate.prototype.savePdf = function (fileName) {
  var inst = this;

  const _scale = inst._scale;

  if (typeof fileName === "undefined") {
    fileName = `${new Date().getTime()}.pdf`;
  }

  // Extract base64-encoded PDF content
  var base64Content = inst.url.split(",")[1];

  // Decode base64 to binary
  var binaryContent = atob(base64Content);

  // Create a Uint8Array from binary data
  var existingPDFBytes = new Uint8Array(binaryContent.length);
  for (var i = 0; i < binaryContent.length; i++) {
    existingPDFBytes[i] = binaryContent.charCodeAt(i);
  }

  var PDFBytes = existingPDFBytes;

  PDFLib.PDFDocument.load(existingPDFBytes)
    .then(async function (doc) {
      var pages = doc.getPages();

      await Promise.all(
        inst.fabricObjects.map(async (fabricObj, index) => {
          pages[index].scale(_scale, _scale);
          var pageWidth = pages[index].getWidth();
          var pageHeight = pages[index].getHeight();
          var fabricWidth = inst.fabricObjects[index].width;
          var fabricHeight = inst.fabricObjects[index].height;

          var dataObjs = inst.fabricObjects[index].getObjects();

          await Promise.all(
            dataObjs.map(async (dataObj, jIndex) => {
              const DOLeft = dataObj.left;
              const DOTop = dataObj.top;
              const DOWidth = dataObj.width;
              const DOHeight = dataObj.height;

              const px = dataObj.left / _scale;
              const py = (pageHeight - dataObj.top) / _scale;

              if (dataObj.type === "path") {
                var fabricPath = new fabric.Path(dataObj.path, dataObj);

                const pathData = offsetPaths(
                  dataObj.path,
                  dataObj.initialLeft,
                  dataObj.initialTop,
                  dataObj.scaleX,
                  dataObj.scaleY,
                  _scale
                );

                const pdfLibColor = convertCssColorToPdfLib(dataObj.stroke);

                // pages[index].drawCircle({
                //   x: px,
                //   y: py,
                //   size: 10,
                //   borderWidth: 1,
                //   color: PDFLib.rgb(0.75, 0.2, 0.2),
                //   opacity: 0.5,
                //   borderOpacity: 0.75,
                // });

                pages[index].drawSvgPath(pathData, {
                  x: px,
                  y: py,
                  borderColor: pdfLibColor,
                  borderWidth: parseInt(dataObj.strokeWidth),
                  scale: 1,
                  borderLineCap: 1,
                  rotate: PDFLib.degrees(-dataObj.angle),
                });

                // PDFBytes = await doc.save();
              } else if (dataObj.type === "image") {
                console.log(".....image...");

                let height = (dataObj.height * dataObj.scaleY) / _scale;
                let width = (dataObj.width * dataObj.scaleX) / _scale;

                var imageBytes = await fetch(
                  inst.fabricObjectsData[index].objects[jIndex].src
                ).then((response) => response.arrayBuffer());

                var image;

                var imgprefix =
                  inst.fabricObjectsData[index].objects[jIndex].src.split(
                    ","
                  )[0];

                if (imgprefix.includes("image/png")) {
                  image = await doc.embedPng(imageBytes);
                } else {
                  image = await doc.embedJpg(imageBytes);
                }

                pages[index].drawImage(image, {
                  x: px,
                  y: py,
                  height: height,
                  width: width,
                  opacity: 1,
                  rotate: PDFLib.degrees(-dataObj.angle),
                });
              } else if (dataObj.type === "i-text") {
                console.log("text: ", dataObj.text);

                const textColor = convertCssColorToPdfLib(dataObj.fill);

                // Set up the font and font size
                const font = await doc.embedFont(
                  PDFLib.StandardFonts.Helvetica
                );
                const fontSize = dataObj.fontSize;

                // Set up the text content
                const textContent = dataObj.text;

                const doHeight = dataObj.height / _scale;

                const desiredHeight = doHeight * dataObj.scaleY * 1.15;

                const newSize = parseInt(
                  ((desiredHeight * font.sizeAtHeight(doHeight)) / doHeight) *
                    0.73
                );

                // Add the scaled text to the page
                pages[index].drawText(textContent, {
                  font,
                  x: px,
                  y: py + desiredHeight / 4,
                  size: newSize,
                  opacity: dataObj.opacity,
                  color: textColor,
                  rotate: PDFLib.degrees(-dataObj.angle),
                });
              } else if (dataObj.type === "rect") {
                const borderColor = convertCssColorToPdfLib(dataObj.stroke);
                const rectangleFill = convertCssColorToPdfLib(dataObj.fill);
                console.log("rectangle");

                const width = dataObj.width * dataObj.scaleX;
                const height = dataObj.height * dataObj.scaleY;

                await pages[index].drawRectangle({
                  x: px,
                  y: py,
                  borderColor: borderColor,
                  width: width / _scale,
                  height: height / _scale,
                  opacity: dataObj.opacity,
                  borderWidth: dataObj.strokeWidth,
                  color: rectangleFill,
                  rotate: PDFLib.degrees(-dataObj.angle),
                });
              } else if (
                dataObj.type == "lineArrow" &&
                !isNaN(dataObj.top) &&
                !isNaN(dataObj.left) &&
                dataObj.width != 0 &&
                dataObj.height !== 0
              ) {
                console.log("line Arrow");
                var arrowColor = convertCssColorToPdfLib(dataObj.fill);

                const h = (dataObj.height / _scale) * dataObj.scaleY;
                const w = (dataObj.width / _scale) * dataObj.scaleX;

                let _x1 = dataObj.x1 > dataObj.x2 ? px + w / 2 : px - w / 2;
                let _y1 = dataObj.y1 > dataObj.y2 ? py - h / 2 : py + h / 2;

                let _x2 = dataObj.x1 > dataObj.x2 ? px - w / 2 : px + w / 2;
                let _y2 = dataObj.y1 > dataObj.y2 ? py + h / 2 : py - h / 2;

                const pointToRotate1 = [_x1, _y1];
                const rotationCenter1 = [px, py];
                const angleOfRotation1 = -dataObj.angle;

                const rotatedPoint1 = rotatePointAround(
                  pointToRotate1,
                  rotationCenter1,
                  angleOfRotation1
                );

                _x1 = rotatedPoint1[0];
                _y1 = rotatedPoint1[1];

                const pointToRotate2 = [_x2, _y2];
                const rotationCenter2 = [px, py];
                const angleOfRotation2 = -dataObj.angle;

                const rotatedPoint2 = rotatePointAround(
                  pointToRotate2,
                  rotationCenter2,
                  angleOfRotation2
                );
                _x2 = rotatedPoint2[0];
                _y2 = rotatedPoint2[1];

                const point1 = [_x1, _y1];
                const point2 = [_x2, _y2];
                const shortenedPoint = shortenLine(point1, point2, 15);

                const dx = shortenedPoint[0] - _x1;
                const dy = -(shortenedPoint[1] - _y1);

                const length = Math.sqrt(w ** 2 + h ** 2) - 20; //20 is the length of the head.

                pages[index].drawLine({
                  start: { x: _x1, y: _y1 },
                  end: { x: shortenedPoint[0], y: shortenedPoint[1] },
                  thickness: dataObj.strokeWidth,
                  color: arrowColor,
                  opacity: 1,
                });

                const center_x = 0;
                const center_y = 0;
                const point_x = dx;
                const point_y = dy;
                const circle_radius = (length - 20) / 2;

                const tangentPoints = findTangentPoints(
                  center_x,
                  center_y,
                  point_x,
                  point_y,
                  circle_radius
                );

                let apex = findApex(tangentPoints[0], tangentPoints[1], 25);

                if (_y2 > _y1) {
                  apex = rotatePoint180Degrees(apex, { x: dx, y: dy });
                }

                const pathActions = {
                  down: `M 0 0`,
                  forward: `L ${dx} ${dy}`,
                  arrowUp: `L ${tangentPoints[0].x} ${tangentPoints[0].y}`,
                  slantForward: `L ${apex.x} ${apex.y}`,
                  slantBackwrd: `L ${tangentPoints[1].x} ${tangentPoints[1].y}`,
                  arrowBelow: `L ${dx} ${dy}`,
                  close: "Z",
                };

                const path = Object.values(pathActions).join(" ");

                pages[index].drawSvgPath(path, {
                  x: _x1,
                  y: _y1,
                  color: arrowColor,
                  borderColor: arrowColor,
                });
              }
            })
          );

          const _negateScale = _scale * 0.44405;

          pages[index].scale(_negateScale, _negateScale);
        })
      );

      PDFBytes = await doc.save();
      downloadPDF(PDFBytes, "modified_document.pdf");
    })
    .catch(function (error) {
      console.error("Error loading existing PDF:", error);
    });
};

PDFAnnotate.prototype.setBrushSize = function (size) {
  var inst = this;
  $.each(inst.fabricObjects, function (index, fabricObj) {
    fabricObj.freeDrawingBrush.width = parseInt(size);
  });
};

PDFAnnotate.prototype.setColor = function (color) {
  var inst = this;
  inst.color = color;
  $.each(inst.fabricObjects, function (index, fabricObj) {
    fabricObj.freeDrawingBrush.color = color;
  });
};

PDFAnnotate.prototype.setBorderColor = function (color) {
  var inst = this;
  inst.borderColor = color;
};

PDFAnnotate.prototype.setFontSize = function (size) {
  this.font_size = size;
};

PDFAnnotate.prototype.setBorderSize = function (size) {
  this.borderSize = size;
};

PDFAnnotate.prototype.clearActivePage = function () {
  var inst = this;
  var fabricObj = inst.fabricObjects[inst.active_canvas];
  var bg = fabricObj.backgroundImage;
  if (confirm("Are you sure?")) {
    fabricObj.clear();
    fabricObj.setBackgroundImage(bg, fabricObj.renderAll.bind(fabricObj));
  }
};

PDFAnnotate.prototype.serializePdf = function () {
  var inst = this;
  return JSON.stringify(inst.fabricObjects, null, 4);
};

PDFAnnotate.prototype.loadFromJSON = function (jsonData) {
  var inst = this;
  $.each(inst.fabricObjects, function (index, fabricObj) {
    if (jsonData.length > index) {
      fabricObj.loadFromJSON(jsonData[index], function () {
        inst.fabricObjectsData[index] = fabricObj.toJSON();
      });
    }
  });
};
