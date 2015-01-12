# Please Mind The Gap (WIP)

## General Idea
- playing from first-person-perspective
- objects/platforms appear in front of the player, forming a bridge
- out of the sight of the player platforms/objects dissapear
- objects fall from the top aswell and can hit the player
- objects each have specific functions that are activated with user interaction
- those active objects are generally only a part of all possible objects
- objects are used to walk along


## possible goal
- reach another platform
- survive, don't fall or get hit

## Types of activatable objects

- gravity/force: push surrounding objects or get them closer
- create objects without mass or big enough to not fall down. To be used as extra
bridging element. increase bridge.
- transform objects in size


## TODO (in chronological order)
- (see also: github issue list)
- create plattforms that grow and shrink made of several overlapping objects
  with zero gravity.
- define behaviour of different objects and implement them
- allow different forms of geometry (maybe based on behaviour, elliptical -> gravity,
  blocky -> create linear new stuff, chaotic -> ...)
- fix jumping and actions (set bool to check wether jump/action can be performed)
- add instruction box (thats clickable to demonstrate feature, create first platform)
