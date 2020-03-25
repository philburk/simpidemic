/**
 * Epidemic Simulator
 * Author: Phil Burk
 * Apache Open Source
 */

// ChartMaker - displays multiple data sets, axes
// VirusModel - R0(day), mortality(age)
// CompartmentModel - population, demographics,
// MitigationModel - social distancing, vaccination, hospital capacity
// VirusEditor
// CompartmentEditor
// SimulationEngine
// EpidemicSimulator - top level application class


var addAttribute = function(element, name, value) {
    var att = document.createAttribute(name);
    att.value = value;
    element.setAttributeNode(att);
    return att;
}

class ParameterModel {
    constructor(name, min, max, value) {
        this.name = name;
        this.min = min;
        this.max = max;
        this.value = value;
        this.listeners = [];
    }

    getValueString() {
        return "" + this.value.toFixed(2);
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
        this.div = document.createElement('div');
        var paragraph = document.createElement('p');
        paragraph.style = "float: left";
        var textNode = document.createTextNode(parameterModel.name + ": ");
        paragraph.appendChild(textNode);
        this.span = document.createElement('span');
        paragraph.appendChild(this.span);
        this.div.appendChild(paragraph);

        var slider = document.createElement('input');
        this.slider = slider;
        slider.type = "range";
        slider.min = 0;
        slider.max = 1000;
        slider.value = this.valueToPosition(parameterModel.getValue());
        slider.class = "slider";
        slider.addEventListener("input", this);
        this.div.appendChild(slider);
        var clearDiv = document.createElement('div');
        clearDiv.style = "clear: left";
        this.div.appendChild(clearDiv);

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
        this.span.innerHTML = this.parameterModel.getValueString();
    }

    getElement() {
        return this.div;
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
    }

    getTransmissionProbability(day) {
        return (day >= this.transmissionProbabilities.length)
                ? 0.0 : this.transmissionProbabilities[day];
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

    addParamemeterEditors() {
        var models = this.epidemic.getParameterModels();
        var i = 0, length = models.length;
        for (; i < length;) {
            let model = models[i];
            model.addListener(this);
            var slider = new RangeSlider(model);
            this.topDiv.appendChild(slider.getElement());
            i++;
        }
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
        //addAttribute(canvas, "width", width);
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
        this.virus = new VirusModel();
        this.parameters = [];
        this.contactsPerDayModel = new ParameterModel("contactsPerDay", 0.5, 10.0, 3.0);
        this.parameters.push(this.contactsPerDayModel);
        this.infectionMortalityModel = new ParameterModel("infectionMortality", 0.0, 100.0, 5.0);
        this.parameters.push(this.infectionMortalityModel);
        this.initialPopulation = 10000;
    }

    getParameterModels() {
        return this.parameters;
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
        let infectionMortality = this.infectionMortalityModel.getValue();
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
            let newlyDead = Math.round(oldInfected * infectionMortality / 100);
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
