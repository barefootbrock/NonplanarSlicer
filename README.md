# NonplanarSlicer
A web-based arbitrary nonplanar slicing transformation app inspired by the conical slicing algorithm of Wüthrich et al. 
See CNC Kitchen's video for more information on conical/nonplanar slicing: https://youtu.be/1i-1TEdByZY

A demo is available at https://nonplanarslicer.davidbrock1.repl.co/

The slicing process works as follows:
 1. Select a slice shape (conical up/down, custom, etc.) and input the required parameters
 2. Import an STL model to transform. Make sure it has the correct position and orientation.
 3. Transform the model. Depending on the model, it may need to be refined first. The transformed result will appear in the right view.
 4. Download the transformed STL and slice it in your favorite slicer. Note that skirts and brims can cause problems.
 5. Import the generated GCODE and make sure it aligns with the transformed model.
 6. Refine and back-transform the GCODE.
 7. Download the new GCODE and print it!
