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


// TODO log taper
// TODO Chart axes, scale
// TODO Add Action,
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
    "SINGLE":1,
    "ARRAY":2
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
    }

    valueToString(value) {
        return value.toFixed(this.numericFractionalDigits).padStart(this.numericWidth, '0');
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

class ParameterModel extends ParameterModelBase {
    constructor(name, min, max, value) {
        super(name, min, max);
        this.value = value;
    }

    getType() {
        return ParameterType.SINGLE;
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
        slider.addEventListener("input", this);

        this.updateValueText();
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

    drawTrace(chartTrace) {
        this.ctx.beginPath();
        this.ctx.lineWidth = "2";
        this.ctx.strokeStyle = chartTrace.style; // Green path
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

class VirusModel {
    constructor() {
        this.parameters = [];
        let transmissionProbabilities =
            [0.0, 0.0, 0.1, 0.2, 0.5, 0.9, 0.7,  0.2, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0];
        this.transmissionProbabilitiesModel = new ParameterArrayModel("transmissionProbabilitiesByDay",
                0.0, 1.0, transmissionProbabilities);
        this.parameters.push(this.transmissionProbabilitiesModel);

        this.infectionMortalityTreatedModel = new ParameterModel("mortalityTreated", 0.0, 100.0, 2.0);
        this.parameters.push(this.infectionMortalityTreatedModel);
        this.infectionMortalityUntreatedModel = new ParameterModel("mortalityUntreated", 0.0, 100.0, 10.0);
        this.parameters.push(this.infectionMortalityUntreatedModel);
        this.dayTreatmentBeginsModel = new ParameterModel("dayTreatmentBegins",
                0.0, transmissionProbabilities.length, 7.0);
        this.parameters.push(this.dayTreatmentBeginsModel);
        this.treatmentDurationModel = new ParameterModel("treatmentDuration", 0.0, 40.0, 14.0);
        this.parameters.push(this.treatmentDurationModel);
        this.infectionMortalityUntreatedModel = new ParameterModel("mortalityUntreated", 0.0, 100.0, 10.0);
        this.parameters.push(this.infectionMortalityUntreatedModel);
        this.immunityLossModel = new ParameterModel("immunityLoss", 0.0, 0.1, 0.01);
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
        this.recovered = 0;
    }

    getPopulation() {
        return this.succeptible + this.infected + this.recovered;
    }
}

class SimulationResults {
    constructor() {
        this.numDays = 0;
        this.infectedArray = [];
        this.recoveredArray = [];
        this.succeptibleArray = [];
        this.deadArray = [];
    }
}

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
        this.chart.setDataMax(this.epidemic.getInitialPopulation());
        this.chart.addClickListener(this);
    }

    reportDay(day) {
        let text = "Day " + day;
        text += ", infected = " + this.lastResults.infectedArray[day];
        text += ", recovered = " + this.lastResults.recoveredArray[day];
        text += ", dead = " + this.lastResults.deadArray[day];
        this.dailyReportElement.innerHTML = text;
    }

    onClickXY(x, y) {
        this.cursorDay = Math.floor(x);
        this.reportDay(this.cursorDay);
        this.chart.setCursor(this.cursorDay);
        this.chart.draw();
    }

    createTableHeader(name) {
        let th = document.createElement("th");
        let text = document.createTextNode(name);
        th.appendChild(text);
        return th;
    }

    addSingleEditor(model, table) {
        model.addListener(this);
        let smallMargin = "2px";
        let smallPadding = "2px";
        var slider = new RangeSlider(model);
        let row = table.insertRow();
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

    addArrayEditor(model, table) {
        model.addListener(this);
        var editor = new ArrayEditor(model, 350, 100);
        let row = table.insertRow();
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
            switch(model.getType()) {
                case ParameterType.SINGLE:
                    this.addSingleEditor(model, table);
                    break;
                case ParameterType.ARRAY:
                    this.addArrayEditor(model, table);
                    break;
                default:
            }
        }
        return table;
    }


    addParameterEditors() {
        // make Table for editors
        let table = document.createElement("TABLE");
        let tHead = table.createTHead();
        let row = tHead.insertRow();
        row.appendChild(this.createTableHeader("Virus"));
        row.appendChild(this.createTableHeader("General"));
        row = table.insertRow();
        let cell = row.insertCell();
        let models = this.epidemic.getVirusParameterModels();
        cell.appendChild(this.createParameterEditor(models));
        cell = row.insertCell();
        models = this.epidemic.getGeneralParameterModels();
        cell.appendChild(this.createParameterEditor(models));
        this.topDiv.appendChild(table);
    }


    onChange(model) {
        this.refresh();
    }

    refresh() {
        var results = this.epidemic.simulate();
        this.lastResults = results;
        this.infectedTrace.data = results.infectedArray;
        this.recoveredTrace.data = results.recoveredArray;
        this.deadTrace.data = results.deadArray;
        this.chart.draw();

        if (this.cursorDay >= 0) {
            // Avoid cursor beyond end of data.
            if (this.cursorDay >= results.numDays) {
                this.cursorDay = results.numDays - 1;
                this.chart.setCursor(this.cursorDay);
            }
            this.reportDay(this.cursorDay);
        }
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

        this.contactsPerDayModel = new ParameterModel("contactsPerDay", 0.2, 4.0, 2.0);
        this.parameters.push(this.contactsPerDayModel);

        this.treatmentCapacityPer100KModel = new ParameterModel("treatmentCapacityPer100K", 0.0, 10000.0, 25.0);
        this.parameters.push(this.treatmentCapacityPer100KModel);

        this.numDaysModel = new ParameterModel("numDays", 40, 600.0, 100.0);
        this.parameters.push(this.numDaysModel);
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

    simulate() {
        var compartment = new CompartmentModel(this.initialPopulation, 1);
        var results = new SimulationResults();
        console.log("============ population = " + compartment.getPopulation());
        var i = 0;
        var cases = [];
        compartment.infected = 1;
        let totalDead = 0;
        // Get initial parameters from models.
        const numDays = Math.floor(this.numDaysModel.getValue());
        const infectionDuration = this.virus.getInfectionDuration();
        const contactsPerDay = this.contactsPerDayModel.getValue();
        const infectionMortalityTreated = this.virus.getInfectionMortalityTreated();
        const infectionMortalityUntreated = this.virus.getInfectionMortalityUntreated();
        const dayTreatmentBegins = this.virus.getDayTreatmentBegins();
        const treatmentDuration = this.virus.getTreatmentDuration();
        const treatmentCapacityPer100K = this.treatmentCapacityPer100KModel.getValue();
        let treatmentCapacity = Math.round(treatmentCapacityPer100K * this.initialPopulation / 100000);
        let treatmentInUse = 0;
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
        infectedFIFO.unshift(compartment.infected);
        treatmentFIFO.unshift(0);
        for (i = 0; i < numDays; i++) {
            // Population changes due to deaths.
            let population = compartment.getPopulation();
            // Convolve the daily transmission probability with
            // the number of infected cases for that day.
            let dailyTransmissionRate = 0;
            for (let day = 0; day < infectionDuration; day++) {
                dailyTransmissionRate += this.virus.getTransmissionProbability(day)
                        * infectedFIFO[day];
            }
            let newlyInfected =
                    contactsPerDay
                    * dailyTransmissionRate
                    * compartment.succeptible
                    / population;
            //newlyInfected += this.calculateDitherOffset();
            newlyInfected = Math.max(0, Math.round(newlyInfected));
            newlyInfected = Math.min(compartment.succeptible, newlyInfected);

            // TODO treatment model needs to account for multiple days of treatment
            // and triage.
            const endingInfection = infectedFIFO.pop();
            const endingTreatment = treatmentFIFO.pop();
            treatmentInUse -= endingTreatment;
            // TODO Consider patients that die during treatment.
            // How many of those needing treatment and received treatment will die.
            const dieAfterTreatment = Math.round(endingTreatment * infectionMortalityTreated / infectionMortalityUntreated);
            const recoverAfterTreatment = endingTreatment - dieAfterTreatment;
            // Only treat those who would die if untreated.
            const needingBeginTreatment = Math.round(infectedFIFO[dayTreatmentBegins] * infectionMortalityUntreated / 100);
            infectedFIFO[dayTreatmentBegins] -= needingBeginTreatment;
            const treatmentAvailable = treatmentCapacity - treatmentInUse;
            const beginningTreatment = Math.min(needingBeginTreatment, treatmentAvailable);
            treatmentInUse += beginningTreatment;
            // How many will die immediately because of no treatment.
            const dieForLackOfTreatment = needingBeginTreatment - beginningTreatment;
            const newlyDead = dieAfterTreatment + dieForLackOfTreatment;

            let newlyRecovered = endingInfection + recoverAfterTreatment;

            // Some recovered people will lose immunity.
            let recoveredThatLoseImmunity = Math.round(immunityLoss * compartment.recovered);

            compartment.succeptible += recoveredThatLoseImmunity - newlyInfected;
            compartment.recovered += newlyRecovered - recoveredThatLoseImmunity;
            compartment.infected += newlyInfected - (newlyRecovered + newlyDead);
            totalDead += newlyDead;
            infectedFIFO.unshift(newlyInfected);
            treatmentFIFO.unshift(beginningTreatment);

            // console.log("day = " + i
            //     + ", succeptible = " + compartment.succeptible
            //     + ", infected = " + compartment.infected
            //     + ", recovered = " + compartment.recovered
            //     + ", newlyRecovered = " + newlyRecovered
            //     + ", newlyDead = " + newlyDead
            //     + ", population = " + compartment.getPopulation()
            // );
            results.infectedArray.push(compartment.infected);
            results.succeptibleArray.push(compartment.succeptible);
            results.recoveredArray.push(compartment.recovered);
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
