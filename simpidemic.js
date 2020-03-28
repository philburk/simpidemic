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

// TODO prevent jumping by using fixed width numeric fields
// TODO log taper
// TODO cursor, show daily values
// TODO align slider and text
// TODO Chart axes, scale
// TODO Add Action,
// TODO Action List/Editor, X-delete
// TODO Model mortality(age)

// var addAttribute = function(element, name, value) {
//     var att = document.createAttribute(name);
//     att.value = value;
//     element.setAttributeNode(att);
//     return att;
// }

class ParameterModel {
    constructor(name, min, max, value) {
        this.name = name;
        this.min = min;
        this.max = max;
        this.value = value;
        this.listeners = [];

        let significantDigits = 4;
        this.numericWidth = significantDigits;
        let logMax = Math.log10(max);
        this.numericFractionalDigits = Math.max(0, significantDigits - Math.floor(logMax + 1));
        if (this.numericFractionalDigits > 0) {
            this.numericWidth++; // make room for the decimal point
        }
    }

    getValueString() {
        return this.value.toFixed(this.numericFractionalDigits).padStart(this.numericWidth, '0');
    }

    getValue() {
        return this.value;
    }

    setValue(value) {
        this.value = value;
        this.fireListeners();
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

class ChartTrace {
    constructor(name, data) {
        this.name = name;
        this.data = data;
        this.style = "blue";
    }
}

class ChartMaker {
    constructor(canvas) {
        this.ctx = canvas.getContext("2d");
        this.width = canvas.width;
        this.height = canvas.height;
        this.dataMax = 0;
        this.traces = [];
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height)
    }

    addTrace(chartTrace) {
        this.traces.push(chartTrace);
    }

    setDataMax(dataMax) {
        this.dataMax = dataMax;
    }

    drawTrace(chartTrace) {
        this.ctx.beginPath();
        this.ctx.lineWidth = "3";
        this.ctx.strokeStyle = chartTrace.style; // Green path
        this.ctx.moveTo(0, this.height);
        let data = chartTrace.data;
        let localMax = this.dataMax > 0 ? this.dataMax : Math.max.apply(null, data);
        var yScaler = this.height / localMax;
        var i;
        for (i = 0; i < data.length; i++) {
          var x = i * this.width / data.length;
          var y = this.height - (yScaler * data[i]);
          this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
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
        this.transmissionProbabilities =
            [0.0, 0.0, 0.1, 0.2, 0.5, 0.9, 0.7,   0.2, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0];

        this.parameters = [];
        this.infectionMortalityTreatedModel = new ParameterModel("mortalityTreated", 0.0, 100.0, 5.0);
        this.parameters.push(this.infectionMortalityTreatedModel);
        this.infectionMortalityUntreatedModel = new ParameterModel("mortalityUntreated", 0.0, 100.0, 5.0);
        this.parameters.push(this.infectionMortalityUntreatedModel);
    }

    getParameterModels() {
        return this.parameters;
    }

    getTransmissionProbability(day) {
        return (day >= this.transmissionProbabilities.length)
                ? 0.0 : this.transmissionProbabilities[day];
    }

    getInfectionMortalityTreated() {
        return this.infectionMortalityTreatedModel.getValue();
    }

    getInfectionMortalityUntreated() {
        return this.infectionMortalityUntreatedModel.getValue();
    }

    getInfectionDuration() {
        return this.transmissionProbabilities.length;
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
        this.infectedArray = [];
        this.recoveredArray = [];
        this.deadArray = [];
    }
}

class ESimUI {
    constructor(epidemic, topDiv) {
        this.epidemic = epidemic;
        this.topDiv = topDiv;
        console.log(this.topDiv);
        this.appendParagraph("Disclaimer: IANAE");
        this.addParamemeterEditors();
        this.addChart();
    }

    addChart() {
        this.canvas = this.appendCanvas(1000, 300, "border:2px solid #d3d3d3");
        this.chart = new ChartMaker(this.canvas);
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
    }

    createTableHeader(name) {
        let th = document.createElement("th");
        let text = document.createTextNode(name);
        th.appendChild(text);
        return th;
    }

    createParameterEditor(models) {
        let table = document.createElement("TABLE");
        var i = 0, length = models.length;
        for (; i < length;) {
            let model = models[i];
            model.addListener(this);
            var slider = new RangeSlider(model);

            let row = table.insertRow();
            let cell = row.insertCell();
            cell.appendChild(document.createTextNode(model.name + " = "));
            cell.align = "right";

            cell = row.insertCell();
            cell.appendChild(slider.getNumericElement());

            cell = row.insertCell();
            cell.appendChild(slider.getElement());
            i++;
        }
        return table;
    }

    addParamemeterEditors() {
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
        this.infectedTrace.data = results.infectedArray;
        this.recoveredTrace.data = results.recoveredArray;
        this.deadTrace.data = results.deadArray;
        this.chart.draw();
    }

    appendCanvas(width, height, style) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style = style;
        this.topDiv.appendChild(canvas);
        return canvas;
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
        this.initialPopulation = 10000;
        this.virus = new VirusModel();
        this.parameters = [];

        this.contactsPerDayModel = new ParameterModel("contactsPerDay", 0.5, 10.0, 3.0);
        this.parameters.push(this.contactsPerDayModel);

        this.treatmentCapacityPer100KModel = new ParameterModel("treatmentCapacityPer100K", 0.0, 2000.0, 25.0);
        this.parameters.push(this.treatmentCapacityPer100KModel);
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
        return Math.random() + Math.random() - 1.0;
    }

    simulate() {
        const numDays = 100;
        var compartment = new CompartmentModel(this.initialPopulation, 1);
        var results = new SimulationResults();
        console.log("============ population = " + compartment.getPopulation());
        var i = 0;
        var cases = [];
        compartment.infected = 1;
        let totalDead = 0;
        let infectionDuration = this.virus.getInfectionDuration();
        let contactsPerDay = this.contactsPerDayModel.getValue();
        let infectionMortalityTreated = this.virus.getInfectionMortalityTreated();
        let infectionMortalityUntreated = this.virus.getInfectionMortalityUntreated();
        let treatmentCapacityPer100K = this.treatmentCapacityPer100KModel.getValue();
        let treatmentCapacity = treatmentCapacityPer100K * this.initialPopulation / 100000;
        let infectedFIFO = [];
        for(var i = 0; i < infectionDuration; i++) {
            infectedFIFO.push(0);
        }
        infectedFIFO.unshift(compartment.infected);
        for (i = 0; i < numDays; i++) {
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
                    / compartment.getPopulation();
            //newlyInfected += this.calculateDitherOffset();
            newlyInfected = Math.max(0, Math.round(newlyInfected));
            newlyInfected = Math.min(compartment.succeptible, newlyInfected);

            let oldInfected = infectedFIFO.pop();
            let oldInfectedTreated = Math.min(oldInfected, treatmentCapacity);
            let oldInfectedUntreated = oldInfected - oldInfectedTreated;
            let newlyDead = Math.round(oldInfectedTreated * infectionMortalityTreated / 100);
            newlyDead += Math.round(oldInfectedUntreated * infectionMortalityUntreated / 100);
            let newlyRecovered = oldInfected - newlyDead;

            compartment.succeptible -= newlyInfected;
            compartment.recovered += newlyRecovered;
            compartment.infected += newlyInfected - oldInfected;
            totalDead += newlyDead;
            infectedFIFO.unshift(newlyInfected);

            // console.log("day = " + i
            //     + ", succeptible = " + compartment.succeptible
            //     + ", infected = " + compartment.infected
            //     + ", recovered = " + compartment.recovered
            //     + ", newlyRecovered = " + newlyRecovered
            //     + ", newlyDead = " + newlyDead
            //     + ", population = " + compartment.getPopulation()
            // );
            results.infectedArray.push(compartment.infected);
            results.recoveredArray.push(compartment.recovered);
            results.deadArray.push(totalDead);
        }
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
