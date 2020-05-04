[Home](index.html) | [Simulator](simpidemic.html) | [Instructions](howto.md) | Model | [Code](https://github.com/philburk/simpidemic)


# Mathematics of this Epidemic Model

This model is based on a "compartment model" that divides the current population into 4 groups:

1. susceptible
1. infected
1. recovered (immune)
1. in treatment

The simulator starts with the initial number of infected set to one.
Then it moves forward one day at a time and calculates changes in those those four groups.

To see the details of the calculation look for the "simulate()" function
in the [simulator.js](https://github.com/philburk/simpidemic/blob/master/simpidemic.js) file.

## How Many Become Infected Each Day?

We use a value called the dailyTransmissionRate, which is the probability that an
infected person will infect another person that they come into contact with,
times the number of infected people.
We multiply this by the number of contactsPerDay.
Not every contact can be infected. Some people will already be infected and some people will be recovered and therefore immune.
So we multiply by the probability that a contact will be susceptible.
This is the number of "susceptible" people divided by the total population.

    newInfections = contactsPerDay * dailyTransmissionRate * susceptible / population
    
## Calculating the Daily Transmission Rate

When a person becomes infected, they are not immediately contagious.
They become more contagious over the course of a few days and then become less contagious over time.
We use two parameters to model this progression, peakContagiousDay and contagiousness.

To calculate the probability of transmission for any given day for one person we use an equation that has a reasonable shape.

    Inputs:
    c = contagiousness
    p = peakContagiousDay
    x = day
    
    probability = c * (x / p) / (p * exp(x / p))
    
You can experiment with this equation using the [Desmos online graphing calculator](https://www.desmos.com/calculator/lnrfyrbej8).

To calculate the dailyTransmissionRate we need to add up the probability of each infected persion based on how many days they have been infected.

    dailyTransmissionRate = sum(probability(day) * numberInfectedFor(day))
    
## Modelling Treatment

In this model, the term "treatment" refers to life-saving treatment that may be in short supply.
It does not refer to basic care, which we assume is generally available.

We decide who needs life-saving treatment based on the mortality of those who are untreated.
We multiply this by the number of people who have been infected by a certain number of days.

    needingBeginTreatment = infected[dayTreatmentBegins] * infectionMortalityUntreated
    
Not everyone who needs treatment can get treatment. We may not, for example, have enough ventilaors.
And some of them will already be in use.

    treatmentAvailable = treatmentCapacity - inTreatment
    beginningTreatment = min(needingBeginTreatment, treatmentAvailable)
    
We can now calculate those who will die because they they do not get treatment:

    dieForLackOfTreatment = needingBeginTreatment - beginningTreatment
    
Those who do get treatment are put in a FIFO that models multiple days of treatment.
When they finish treatment, we calculate how many die even though they received treatment.
We can also calculate how many have recovered after treatment.

    dieAfterTreatment = endingTreatment * infectionMortalityTreated / infectionMortalityUntreated
    recoverAfterTreatment = endingTreatment - dieAfterTreatment
    
Unfortunately some of the people who have recovered will lose immunity for various reasons.
One reason is "antigen drift", where the virus mutates slightly and is no longer recognized by the person's immune system.

    recoveredThatLoseImmunity = immunityLoss * recovered
    
We can now modify the population:

    susceptible += recoveredThatLoseImmunity - beginningInfection
    recovered += endingInfection + recoverAfterTreatment - recoveredThatLoseImmunity
    infected += beginningInfection - (endingInfection + beginningTreatment)
    inTreatment += beginningTreatment - endingTreatment
    
The dead are removed from the population:

    totalDead += dieAfterTreatment + dieForLackOfTreatment

## Why the Model is Not Realistic

This model is just a crude simulation. There are many areas where this model could be improved.

Differrent places have different outcomes. New York is more dense than Wyoming.
That will increase the contactsPerDay.
Better models will use multiple "compartments" to simulate different geographic areas.

Age is also a factor.
Older people, for example, are more likely to die from COVID-19 than younger people.
Also different areas have higher proportions of older people. Compare Florida vs Vermont.

Some sophisticated models track individuals in a population.
That is more realistic because every person has their own trajectory.
But it can take a lot more time to calculate those kinds of models and I wanted this model to respond in real-time.
