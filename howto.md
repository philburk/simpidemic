[Home](index.html) | [Simulator](simulator.html) | Instructions | [Code](https://github.com/philburk/simpidemic)

# How to Use the Simulator

## Controlling the Simulator

Use the sliders to change the parameters. The chart will update immediately.

Click on the chart to see detailed numbers for a specific day.

## Actions

You can apply an Action on a specific day. You can change, for example, the contactsPerDay, which is a measure of "social distancing".

1. Click on the chart to select a day.
1. Click on an Actions button, eg. "Add change to contactsperDay" button.
1. Change that slider and see the effect beginning with the selected day.
1. Click the checkbox to temporarity disable the Action.
1. Click the "X" button to delete the Action.

## Virus Parameters

These parameters are specific to the virus or the disease.

**treatmentProbabilityPerDay** = the probability of transmitting the virus from an infected person to an uninfected contact.
The bar chart shows the probability for each day. The probabilities range from 0.0 to 1.0.

**mortalityUntreated** = the percentage mortality for those infected and who are **not** treated.
Note that this is different than the "case mortality rate". The treatment in this case refers to some critical treatment that may be in short supply, for example a ventilator or new drug.

**mortalityTreated** = the percentage mortality for those infected and who are treated.

**dayTreatmentBeging** = the average number of days between infection and the beginning of treatment.

**treatmentDuration** = the number of days required for treatment.

**immunityLoss** = the percentage of recovered patients who will lose their immunity in a day

## General Parameters

These parameters may vary by region.

**contactsPerDay** = the average number of people that the average person comes into close contact with per day.
To "lockdown" a population by increasing "social distance" you should **lower** this number.

**treatCapPer100K** = the maximum number of people out of 100,000 who can be treated. This might reflect, for example, the number of ventilators available.

**numDays** = the number of days to run the simulatin.
