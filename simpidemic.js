/**
 * Epidemic Simulator
 * Author: Phil Burk
 * Apache Open Source
 */

// Table of Classes
// ChartMaker - displays multiple data sets, axes
// VirusModel - transmission probability, mortality(age)
// CompartmentModel - population, demographics,
// EpidemicModel - top level model and simulator
// EpidemicSimulator - top level application class


// TODO Add Action,
// TODO log taper
// TODO Chart axes, scale
// TODO Action List/Editor, X-delete
// TODO Add demographic model
// TODO Model mortality(age)
// TODO model testCapacityperDay
// TODO Calculate confirmed cases vs hidden infected
// TODO improve treatment model, 2 weeks on vent
// TODO add triage model

// var addAttribute = function(element, name, value) {
//     var att = document.createAttribute(name);
//     att.value = value;
//     element.setAttributeNode(att);
//     return att;
// }

const kInitialPopulation = 100000;

const ParameterType = Object.freeze({
    "FLOAT":1,
    "INTEGER":2,
    "ARRAY":3
});

class ParameterModelBase {
    constructor(name, min, max) {
        this.name = name;
        this.min = min;
        this.max = max;
        this.listeners = [];

        let significantDigits = 4;
        this.numericWidth = significantDigits;
        let logMax = Math.log10(max);
        this.numericFractionalDigits = Math.max(0, significantDigits - Math.floor(logMax + 1));
        if (this.numericFractionalDigits > 0) {
            this.numericWidth++; // make room for the decimal point
        }
        this.actionable = false; // Can this be an action item.
    }

    getName() {
        return this.name;
    }

    valueToString(value) {
        return value.toFixed(this.numericFractionalDigits);
    }

    fireListeners() {
        for (var i = 0, length = this.listeners.length; i < length; i++) {
            let listener = this.listeners[i];
            listener.onChange(this);
        }
    }

    addListener(listener) {
        this.listeners.push(listener);
    }
}

class ParameterFloatModel extends ParameterModelBase {
    constructor(name, min, max, value) {
        super(name, min, max);
        this.value = value;
    }

    makeCopy() {
        return new ParameterFloatModel(this.name, this.min, this.max, this.value);
    }

    getType() {
        return ParameterType.FLOAT;
    }

    getValueString() {
        return this.valueToString(this.value);
    }

    getValue() {
        return this.value;
    }

    setValue(value) {
        this.value = value;
        this.fireListeners();
    }
}

class ParameterIntegerModel extends ParameterFloatModel {
    constructor(name, min, max, value) {
        super(name, min, max);
        this.value = Math.round(value);
    }

    makeCopy() {
        return new ParameterIntegerModel(this.name, this.min, this.max, this.value);
    }

    valueToString(value) {
        return value.toFixed(0);
    }

    getType() {
        return ParameterType.INTEGER;
    }

    setValue(value) {
        this.value = Math.round(value);
        this.fireListeners();
    }
}

class ParameterArrayModel extends ParameterModelBase {
    constructor(name, min, max, dataArray) {
        super(name, min, max);
        this.dataArray = dataArray;
    }

    getType() {
        return ParameterType.ARRAY;
    }

    getValue(index) {
        return this.dataArray[index];
    }

    setValue(index, value) {
        this.dataArray[index] = value;
        this.fireListeners();
    }

    size() {
        return this.dataArray.length;
    }
}

// <div class="slidecontainer">
//   <input type="range" min="1" max="100" value="50" class="slider" id="myRange">
//   <p>Value: <span id="demo"></span></p>
// </div>
class RangeSlider {
    constructor(parameterModel) {
        this.parameterModel = parameterModel;

        // Construct HTML elements
        this.numericElement = document.createElement('p');
        this.numericElement.style.fontFamily = "monospace";

        var slider = document.createElement('input');
        this.slider = slider;
        slider.type = "range";
        slider.min = 0;
        slider.max = 10000;
        slider.value = this.valueToPosition(parameterModel.getValue());
        slider.class = "slider";
        this.addEventListener("input", this);

        this.updateValueText();
    }

    addEventListener(type, listener) {
        this.slider.addEventListener(type, listener);
    }

    positionToValue(position) {
        let range = this.parameterModel.max - this.parameterModel.min;
        return this.parameterModel.min
                + (range * (position / this.slider.max));
    }

    valueToPosition(value) {
        let range = this.slider.max - this.slider.min;
        return range * (value / this.parameterModel.max);
    }

    handleEvent(event) {
        let value = this.positionToValue(this.slider.value);
        this.parameterModel.setValue(value);
        this.updateValueText();
    }

    updateValueText() {
        this.numericElement.innerHTML = this.parameterModel.getValueString();
    }

    getElement() {
        return this.slider;
    }

    getNumericElement() {
        return this.numericElement;
    }

    setEnabled(enabled) {
        this.slider.disabled = !enabled;
    }
}

class CanvasBasedWidget {
    constructor(width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        this.canvas = canvas;

        this.ctx = canvas.getContext("2d");
        this.width = canvas.width;
        this.height = canvas.height;
        this.listeners = [];
    }

    getElement() {
        return this.canvas;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height)
    }

}

class ArrayEditor extends CanvasBasedWidget {
    constructor(parameterArrayModel, width, height) {
        super(width, height);
        this.parameterArrayModel = parameterArrayModel;
        //this.canvas.style.width = "100%";
        this.draw();
        this.dragging = false;

        this.canvas.addEventListener('mousedown', function(event) {
            this.dragging = true;
            let x = event.layerX;
            let y = event.layerY;
            this.onClickXY(x, y);
        }.bind(this));

        this.canvas.addEventListener('mousemove', function(event) {
            if (this.dragging) {
                let x = event.layerX;
                let y = event.layerY;
                this.onClickXY(x, y);
            }
        }.bind(this));

        this.canvas.addEventListener('mouseup', function(event) {
            if (this.dragging) {
                let x = event.layerX;
                let y = event.layerY;
                this.onClickXY(x, y);
                this.dragging = false;
            }
        }.bind(this));
    }

    onClickXY(x, y) {
        let index = this.xToIndex(x);
        let value = this.yToValue(y);
        this.parameterArrayModel.setValue(index, value);
        this.draw();
    }

    xToIndex(x) {
        let numBars = this.parameterArrayModel.size();
        let barWidth = this.canvas.width / numBars;
        return Math.floor(x / barWidth);
    }

    // y = h *(1 - (v - min)/r
    // y/h = 1.0 - (v - min)/r
    // (y/h - 1) * r = -(v - min)
    // (y/h - 1) * r = min - v
    // v = min - ((y/h - 1) * r)
    yToValue(y) {
        let min = this.parameterArrayModel.min;
        let range = this.parameterArrayModel.max - min;
        return min - (((y / this.height) - 1) * range);
    }

    valueToY(value) {
        let range = this.parameterArrayModel.max - this.parameterArrayModel.min;
        let valueOffset = value - this.parameterArrayModel.min;
        return this.height * (1.0 - (valueOffset / range));
    }

    draw() {
        this.clear();
        let numBars = this.parameterArrayModel.size();
        //this.width = this.canvas.parentNode.offsetWidth;
        let barWidth = this.canvas.width / numBars;
        let dataMin = this.parameterArrayModel.min;
        let x = 0;
        for (var i = 0; i < numBars; i++) {
            let value = this.parameterArrayModel.getValue(i);
            let y = this.valueToY(value);
            let h = this.height - y;
            this.ctx.fillRect(x, y, barWidth, h);
            this.ctx.beginPath();
            this.ctx.rect(x, 0, barWidth, this.height);
            this.ctx.stroke();
            x += barWidth;
        }
    }
}

class ChartTrace {
    constructor(name, data) {
        this.name = name;
        this.data = data;
        this.style = "blue";
    }
}

class ChartMaker extends CanvasBasedWidget {
    constructor(width, height, style) {
        super(width, height);
        this.canvas.style = style;

        this.dataMax = 0;
        this.traces = [];
        this.cursor = -1;

        this.canvas.addEventListener('click', function(event) {
            let x = (event.pageX - this.canvas.offsetLeft) / this.xScaler;
            let y = (event.pageY - this.canvas.offsetTop) / this.yScaler;
            this.listeners.forEach(function(listener) {
                listener.onClickXY(x, y);
            });
        }.bind(this));
    }

    getElement() {
        return this.canvas;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height)
    }

    setCursor(value) {
        this.cursor = value;
    }

    addTrace(chartTrace) {
        this.traces.push(chartTrace);
    }

    setDataMax(dataMax) {
        this.dataMax = dataMax;
    }

    addClickListener(listener) {
        this.listeners.push(listener);
    }

    drawMarker(realX, strokeStyle) {
        this.ctx.beginPath();
        this.ctx.lineWidth = "2";
        let x = realX * this.xScaler;
        this.ctx.strokeStyle = strokeStyle;
        this.ctx.moveTo(x, this.height / 2);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();
    }

    drawTrace(chartTrace) {
        this.ctx.beginPath();
        this.ctx.lineWidth = "2";
        this.ctx.strokeStyle = chartTrace.style;
        this.ctx.moveTo(0, this.height);
        let data = chartTrace.data;
        let localMax = this.dataMax > 0 ? this.dataMax : Math.max.apply(null, data);
        let xScaler = this.width / data.length;
        this.xScaler = xScaler;
        var yScaler = this.height / localMax;
        this.yScaler = yScaler;
        for (var i = 0; i < data.length; i++) {
          var x = i * xScaler;
          var y = this.height - (yScaler * data[i]);
          this.ctx.lineTo(x, y);
          this.ctx.arc(x, y, 2, 0, 2 * Math.PI);
          this.ctx.moveTo(x, y);
        }
        this.ctx.stroke();
        // Draw cursor if enabled.
        if (this.cursor >= 0) {
            let x = this.cursor * xScaler;
            this.ctx.beginPath();
            this.ctx.lineWidth = "2";
            this.ctx.strokeStyle = "black";
            this.ctx.moveTo(x, this.height);
            this.ctx.lineTo(x, 0);
            this.ctx.stroke();
        }
    }

    draw() {
        this.clear();
        for (let trace of this.traces) {
            this.drawTrace(trace);
        }
    }
}

// ================================================================
// ============= Epidemic Specific Code ===========================
// ================================================================

class ActionModel {

    constructor(day, model) {
        this.day = day;
        this.model = model;
        this.active = true;
    }

    get name() {
        return this.model.getName();
    }

    get value() {
        return this.model.getValue();
    }
}

class ActionList {
    constructor(day, model) {
        this.days = [];
    }

    /**
     * @return array of ActionItem objects or undefined
     */
    getDailyActions(day) {
        return this.days[day];
    }

    addActionModel(actionModel) {
        let day = actionModel.day;
        if (this.days[day] == undefined) {
            this.days[day] = [];
        }
        this.days[day].push(actionModel);
    }

    removeActionModel(actionModel) {
        let day = actionModel.day;
        if (this.days[day] != undefined) {
            const index = this.days[day].indexOf(actionModel);
            this.days[day].splice(index, 1);
        }
    }

    /**
    * TODO remove, unused
     * @return array containing every ActionModel
     */
    getAllActions(day) {
       let allActions = [];
       for (var day in this.days) {
           let dailyActions = this.days[day];
           dailyActions.forEach(function(actionModel) {
               allActions.push(actionModel);
           });
       }
       return allActions;
   }
}

class VirusModel {
    constructor() {
        this.parameters = [];
        let transmissionProbabilities =
            [0.0, 0.0, 0.1, 0.2, 0.5, 0.9, 0.7,  0.2, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0];
        this.transmissionProbabilitiesModel = new ParameterArrayModel("transmissionProbabilitiesByDay",
                0.0, 1.0, transmissionProbabilities);
        this.parameters.push(this.transmissionProbabilitiesModel);

        this.infectionMortalityTreatedModel = new ParameterFloatModel("mortalityTreated", 0.0, 100.0, 3.0);
        this.parameters.push(this.infectionMortalityTreatedModel);

        this.infectionMortalityUntreatedModel = new ParameterFloatModel("mortalityUntreated", 0.0, 100.0, 4.0);
        this.parameters.push(this.infectionMortalityUntreatedModel);

        this.dayTreatmentBeginsModel = new ParameterIntegerModel("dayTreatmentBegins",
                0, transmissionProbabilities.length, 7);
        this.parameters.push(this.dayTreatmentBeginsModel);

        this.treatmentDurationModel = new ParameterIntegerModel("treatmentDuration", 0, 40, 14);
        this.parameters.push(this.treatmentDurationModel);

        this.immunityLossModel = new ParameterFloatModel("immunityLoss", 0.0, 0.1, 0.01);
        this.parameters.push(this.immunityLossModel);
    }

    getParameterModels() {
        return this.parameters;
    }

    getTransmissionProbability(day) {
        return this.transmissionProbabilitiesModel.getValue(day);
    }

    getInfectionMortalityTreated() {
        return this.infectionMortalityTreatedModel.getValue();
    }

    getInfectionMortalityUntreated() {
        return this.infectionMortalityUntreatedModel.getValue();
    }

    getDayTreatmentBegins(day) {
        return this.dayTreatmentBeginsModel.getValue(day);
    }

    getTreatmentDuration(day) {
        return this.treatmentDurationModel.getValue(day);
    }

    getImmunityLoss() {
        return this.immunityLossModel.getValue();
    }

    getInfectionDuration() {
        return this.transmissionProbabilitiesModel.size();
    }
}

class CompartmentModel {
    constructor(population, infected) {
        this.succeptible = population - infected;
        this.infected = infected;
        this.inTreatment = 0; // may be infected but under infection control
        this.recovered = 0;
    }

    getInfected() {
        return this.infected;
    }

    getPopulation() {
        return this.succeptible + this.infected
                + this.inTreatment + this.recovered;
    }
}

class SimulationResults {
    constructor() {
        this.numDays = 0;
        this.infectedArray = [];
        this.recoveredArray = [];
        this.succeptibleArray = [];
        this.deadArray = [];
        this.inTreatmentArray = [];
    }
}
/*
class SliderListener {
    constructor(esimUI, model) {
        this.esimUI = esimUI;
        this.model = model;
    }
    handleEvent(event) {
        switch(event.ty)
    }
}
*/

class ESimUI {
    constructor(epidemic, topDiv) {
        this.epidemic = epidemic;
        this.topDiv = topDiv;
        console.log(this.topDiv);
        this.appendParagraph("Disclaimer: In Progress - This has NOT been verified by an epidemiologist.");
        this.addParameterEditors();
        this.dailyReportElement = this.appendParagraph("Day - click on chart to see details for a given day.");
        this.addChart();
        this.cursorDay = -1;
    }

    addChart() {
        this.chart = new ChartMaker(1000, 300, "border:2px solid #d3d3d3");
        this.topDiv.appendChild(this.chart.getElement());
        this.infectedTrace = new ChartTrace("infected", []);
        this.chart.addTrace(this.infectedTrace);
        this.infectedTrace.style = "red";
        this.recoveredTrace = new ChartTrace("recovered", []);
        this.chart.addTrace(this.recoveredTrace);
        this.recoveredTrace.style = "green";
        this.deadTrace = new ChartTrace("dead", []);
        this.chart.addTrace(this.deadTrace);
        this.deadTrace.style = "black";
        this.inTreatmentTrace = new ChartTrace("inTreatment", []);
        this.chart.addTrace(this.inTreatmentTrace);
        this.inTreatmentTrace.style = "blue";

        this.chart.setDataMax(this.epidemic.getInitialPopulation());
        this.chart.addClickListener(this);
    }

    reportDay(day) {
        let text = "Day " + day;
        text += ", infected = " + this.lastResults.infectedArray[day];
        text += ", recovered = " + this.lastResults.recoveredArray[day];
        text += ", inTreatment = " + this.lastResults.inTreatmentArray[day];
        text += ", dead = " + this.lastResults.deadArray[day];
        this.dailyReportElement.innerHTML = text;
    }

    redrawChart() {
        this.chart.setCursor(this.cursorDay);
        this.chart.draw();
        // Draw the actions.
        let rows = this.actionTable.rows;
        for (let i = 0; i < rows.length; i++) {
            let model = rows[i].actionModel;
            let strokeStyle = model.active ? "orange" : "gray";
            this.chart.drawMarker(model.day, strokeStyle);
        }
    }

    onClickXY(x, y) {
        this.cursorDay = Math.floor(x);
        this.reportDay(this.cursorDay);
        this.setActionDay(this.cursorDay);
        this.redrawChart();
    }

    createTableHeader(name) {
        let th = document.createElement("th");
        let text = document.createTextNode(name);
        th.appendChild(text);
        return th;
    }

    addSingleEditor(model, row) {
        model.addListener(this);
        let smallMargin = "2px";
        let smallPadding = "2px";
        var slider = new RangeSlider(model);
        row.style.margin = smallMargin;
        row.style.padding = smallPadding;
        let cell = row.insertCell();
        cell.style.margin = smallMargin;
        cell.style.padding = smallPadding;
        cell.appendChild(document.createTextNode(model.name + " = "));
        cell.align = "right";

        cell = row.insertCell();
        cell.style.margin = smallMargin;
        cell.style.padding = smallPadding;
        let numericElement = slider.getNumericElement();
        numericElement.style.margin = "0px";
        numericElement.style.padding = "0px";
        cell.appendChild(numericElement);

        cell = row.insertCell();
        cell.style.margin = smallMargin;
        cell.style.padding = smallPadding;
        cell.appendChild(slider.getElement());
    }

    addArrayEditor(model, row) {
        model.addListener(this);
        var editor = new ArrayEditor(model, 350, 100);
        let cell = row.insertCell();
        cell.colSpan = 3;
        cell.appendChild(document.createTextNode(model.name));
        cell.appendChild(document.createElement("BR"));
        cell.appendChild(editor.getElement());
    }

    createParameterEditor(models) {
        let table = document.createElement("TABLE");
        var i = 0, length = models.length;
        for (; i < length; i++) {
            let model = models[i];
            let row = table.insertRow();
            switch(model.getType()) {
                case ParameterType.FLOAT:
                case ParameterType.INTEGER:
                    this.addSingleEditor(model, row);
                    break;
                case ParameterType.ARRAY:
                    this.addArrayEditor(model, row);
                    break;
                default:
            }
        }
        return table;
    }

    findActionRow(actionModel) {
        let rows = this.actionTable.rows;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].actionModel === actionModel) {
                return i;
            }
        }
        return -1;
    }

    findRowIndexByDay(day) {
        let rows = this.actionTable.rows;
        let i = 0;
        for (; i < rows.length; i++) {
            if (day < rows[i].actionModel.day) {
                return i;
            }
        }
        return i;
    }

    // Add an editor for a single action
    addActionModelEditor(actionModel) {
        // Insertion sort the action list.
        let day = actionModel.day;
        let rowIndex = this.findRowIndexByDay(day);
        let row = this.actionTable.insertRow(rowIndex);
        row.actionModel = actionModel;
        let cell = row.insertCell();
        let checkbox = document.createElement("input");
        checkbox.setAttribute("type", "checkbox");
        checkbox.checked = actionModel.active;
        checkbox.model = actionModel;
        checkbox.gui = this;
        checkbox.onclick = function() {
            this.model.active = this.checked;
            this.gui.refresh();
        };
        cell.appendChild(checkbox);

        cell.appendChild(document.createTextNode(actionModel.day + ": "));

        this.addSingleEditor(actionModel.model, row);

        cell = row.insertCell();
        let deleteButton = document.createElement("input");
        deleteButton.setAttribute("type", "button");
        deleteButton.value = "X";
        deleteButton.gui = this;
        deleteButton.actionModel = actionModel;
        deleteButton.onclick = function() {
            let index = this.gui.findActionRow(this.actionModel);
            if (index >= 0) {
                this.gui.actionTable.deleteRow(index);
            }
            this.gui.epidemic.removeActionModel(this.actionModel);
            this.gui.refresh();
        };
        cell.appendChild(deleteButton);
    }

    setActionDay(day) {
        this.actionHelp.innerHTML = "Add action for day " + day;
        for (let i=0; i < this.addActionButtons.length; i++) {
            this.addActionButtons[i].disabled = false;
        }
    }

    createActionEditor() {
        this.actionEditorDiv = document.createElement("DIV");
        let actionNames = this.epidemic.getActionNames();
        this.actionHelp = document.createElement("P");
        this.actionHelp.innerHTML = "Click on the chart to specify a day for action."
        this.actionEditorDiv.appendChild(this.actionHelp);
        this.addActionButtons = [];
        for (let i=0; i < actionNames.length; i++) {
            let addButton = document.createElement("input");
            addButton.setAttribute("type", "button");
            addButton.value = "Add change to " + actionNames[i];
            addButton.gui = this;
            addButton.actionIndex = i;
            addButton.disabled = true;
            addButton.onclick = function() {
                let actionModel = this.gui.epidemic.addActionModel(this.gui.cursorDay, this.actionIndex);
                this.gui.addActionModelEditor(actionModel);
            };
            this.addActionButtons.push(addButton);
            this.actionEditorDiv.appendChild(addButton);
            this.actionEditorDiv.appendChild(document.createElement("BR"));
        }
        this.actionTable = document.createElement("TABLE");
        this.actionEditorDiv.appendChild(this.actionTable);
        return this.actionEditorDiv;
    }

    addParameterEditors() {
        this.nonActionableSliders = [];
        // make Table for editors
        let table = document.createElement("TABLE");
        let tHead = table.createTHead();
        let row = tHead.insertRow();
        row.appendChild(this.createTableHeader("Virus"));
        row.appendChild(this.createTableHeader("General"));
        row.appendChild(this.createTableHeader("Actions"));
        row = table.insertRow();

        let cell = row.insertCell();
        cell.style.verticalAlign = "top";
        let models = this.epidemic.getVirusParameterModels();
        cell.appendChild(this.createParameterEditor(models));

        cell = row.insertCell();
        cell.style.verticalAlign = "top";
        models = this.epidemic.getGeneralParameterModels();
        cell.appendChild(this.createParameterEditor(models));

        cell = row.insertCell();
        cell.style.verticalAlign = "top";
        cell.appendChild(this.createActionEditor());

        this.topDiv.appendChild(table);
    }

    // Parameter listener methods.
    onChange(model) {
        this.refresh();
    }

    refresh() {
        var results = this.epidemic.simulate();
        this.lastResults = results;
        this.infectedTrace.data = results.infectedArray;
        this.recoveredTrace.data = results.recoveredArray;
        this.deadTrace.data = results.deadArray;
        this.inTreatmentTrace.data = results.inTreatmentArray;

        if (this.cursorDay >= 0) {
            // Avoid cursor beyond end of data.
            if (this.cursorDay >= results.numDays) {
                this.cursorDay = results.numDays - 1;
                this.chart.setCursor(this.cursorDay);
            }
            this.reportDay(this.cursorDay);
        }
        this.redrawChart();
    }

    appendParagraph(text) {
        var paragraph = document.createElement('p');
        var textNode = document.createTextNode(text);
        paragraph.appendChild(textNode);
        this.topDiv.appendChild(paragraph);
        return paragraph;
    }

    getCanvas() {
        return this.canvas;
    }
}

class EpidemicModel {

    constructor() {
        this.initialPopulation = kInitialPopulation;
        this.virus = new VirusModel();
        this.parameters = [];

        this.contactsPerDayModel = new ParameterFloatModel("contactsPerDay", 0.2, 4.0, 2.0);
        this.parameters.push(this.contactsPerDayModel);
        this.contactsPerDayModel.actionable = true;

        this.treatmentCapacityPer100KModel = new ParameterIntegerModel("treatCapPer100K", 0, 10000, 25);
        this.parameters.push(this.treatmentCapacityPer100KModel);

        this.numDaysModel = new ParameterIntegerModel("numDays", 40, 600, 100);
        this.parameters.push(this.numDaysModel);

        this.actionList = new ActionList();
        this.actionableModels = [this.contactsPerDayModel, this.treatmentCapacityPer100KModel];
    }

    getGeneralParameterModels() {
        return this.parameters;
    }

    getVirusParameterModels() {
        return this.virus.getParameterModels();
    }

    getInitialPopulation() {
        return this.initialPopulation;
    }

    setContactsPerDay(contactsPerDay) {
        this.contactsPerDay = contactsPerDay;
    }

    calculateDitherOffset() {
        return 0.5 * (Math.random() + Math.random() - 1.0);
    }

    // Actions ========================
    getActionNames() {
        let names = [];
        for (let i = 0; i < this.actionableModels.length; i++) {
            let model = this.actionableModels[i];
            names.push(model.getName());
        }
        return names;
    }

    addActionModel(day, actionIndex) {
        let localModel = this.actionableModels[actionIndex].makeCopy();
        let actionModel = new ActionModel(day, localModel);
        this.actionList.addActionModel(actionModel);
        return actionModel;
    }

    removeActionModel(actionModel) {
        this.actionList.removeActionModel(actionModel);
    }

    calculateTreatmentCapacity(capacityPer100K) {
        return Math.round(capacityPer100K * this.initialPopulation / 100000);
    }

    simulate() {
        var compartment = new CompartmentModel(this.initialPopulation, 1);
        console.log("============ population = " + compartment.getPopulation());
        var results = new SimulationResults();
        let totalDead = 0;
        // Get initial parameters from models.
        const numDays = this.numDaysModel.getValue();
        const infectionDuration = this.virus.getInfectionDuration();
        let contactsPerDay = this.contactsPerDayModel.getValue();
        const infectionMortalityTreated = this.virus.getInfectionMortalityTreated();
        const infectionMortalityUntreated = this.virus.getInfectionMortalityUntreated();
        const dayTreatmentBegins = this.virus.getDayTreatmentBegins();
        const treatmentDuration = this.virus.getTreatmentDuration();
        let treatmentCapacity = this.calculateTreatmentCapacity(
                this.treatmentCapacityPer100KModel.getValue());
        const immunityLoss = this.virus.getImmunityLoss();

        let infectedFIFO = [];
        for(var i = 0; i < infectionDuration; i++) {
            infectedFIFO.push(0);
        }
        let treatmentFIFO = [];
        for(var i = 0; i < treatmentDuration; i++) {
            treatmentFIFO.push(0);
        }
        // most recent number of infected is at infectedFIFO[0]
        infectedFIFO.unshift(compartment.getInfected());
        treatmentFIFO.unshift(0);
        for (var day = 0; day < numDays; day++) {
            // Apply actions for the day.
            let dailyActions = this.actionList.getDailyActions(day);
            if (dailyActions != undefined) {
                for (let actionIndex = 0; actionIndex < dailyActions.length; actionIndex++) {
                    let actionModel = dailyActions[actionIndex];
                    if (actionModel.active) {
                        switch(actionModel.name) {
                            case this.contactsPerDayModel.getName():
                                contactsPerDay = actionModel.value;
                                break;
                            case this.treatmentCapacityPer100KModel.getName():
                                treatmentCapacity = this.calculateTreatmentCapacity(actionModel.value);
                                break;
                        }
                    }
                }
            }

            // Population changes due to deaths.
            const population = compartment.getPopulation();
            const endingInfection = infectedFIFO.pop();
            const endingTreatment = treatmentFIFO.pop();

            // Change in infections ========================
            // Convolve the daily transmission probability with
            // the number of infected cases for that day.
            let dailyTransmissionRate = 0;
            for (let infectedDay = 0; infectedDay < infectedFIFO.length; infectedDay++) {
                dailyTransmissionRate += this.virus.getTransmissionProbability(infectedDay)
                        * infectedFIFO[infectedDay];
            }
            let beginningInfection =
                    contactsPerDay
                    * dailyTransmissionRate
                    * compartment.succeptible
                    / population;
            //beginningInfection += this.calculateDitherOffset();
            beginningInfection = Math.max(0, Math.round(beginningInfection));
            beginningInfection = Math.min(compartment.succeptible, beginningInfection);

            // TODO Consider patients that die during treatment.
            // How many of those needing treatment and received treatment will die.
            // Avoid dividing by zero.
            const denominator = Math.max(0.000001, infectionMortalityUntreated);
            let dieAfterTreatment = Math.round(endingTreatment * infectionMortalityTreated / denominator);
            dieAfterTreatment = Math.min(endingTreatment, dieAfterTreatment);
            const recoverAfterTreatment = endingTreatment - dieAfterTreatment;

            // Only treat those who would die if untreated.
            const needingBeginTreatment = Math.round(infectedFIFO[dayTreatmentBegins] * infectionMortalityUntreated / 100);
            const treatmentAvailable = Math.max(0, treatmentCapacity - compartment.inTreatment);
            const beginningTreatment = Math.min(needingBeginTreatment, treatmentAvailable);
            // Remove treated from infected FIFO so we do not double count them.
            infectedFIFO[dayTreatmentBegins] -= beginningTreatment;

            // How many will die immediately because of no treatment.
            const dieForLackOfTreatment = needingBeginTreatment - beginningTreatment;

            // Some recovered people will lose immunity.
            let recoveredThatLoseImmunity = Math.round(immunityLoss * compartment.recovered);

            compartment.succeptible += recoveredThatLoseImmunity - beginningInfection;
            compartment.recovered += endingInfection
                    + recoverAfterTreatment
                    - recoveredThatLoseImmunity;
            compartment.infected += beginningInfection - (endingInfection + beginningTreatment);
            compartment.inTreatment += beginningTreatment - endingTreatment;

            totalDead += dieAfterTreatment + dieForLackOfTreatment;
            infectedFIFO.unshift(beginningInfection);
            treatmentFIFO.unshift(beginningTreatment);

            // console.log("day = " + i
            //     + ", succeptible = " + compartment.succeptible
            //     + ", infected = " + compartment.infected
            //     + ", recovered = " + compartment.recovered
            //     + ", inTreatment = " + compartment.inTreatment
            //     + ", dieAfterTreatment = " + dieAfterTreatment
            //     + ", population = " + compartment.getPopulation()
            // );
            results.infectedArray.push(compartment.infected);
            results.succeptibleArray.push(compartment.succeptible);
            results.recoveredArray.push(compartment.recovered);
            results.inTreatmentArray.push(compartment.inTreatment);
            results.deadArray.push(totalDead);
        }
        results.numDays = numDays;
        return results;
    }
}

class EpidemicSimulator {
    constructor(topDiv) {
        this.epidemic = new EpidemicModel();
        this.simUI = new ESimUI(this.epidemic, topDiv);
        this.simUI.refresh();
    }
}
